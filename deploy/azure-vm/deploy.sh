#!/usr/bin/env bash
# Deploy the API to the Azure VM. Run from the repo root:
#
#   bash deploy/azure-vm/deploy.sh <vm-host> [git-ref]      # git-ref defaults to origin/main
#
# <vm-host> is the VM's DNS name, e.g. reliefops-api.japaneast.cloudapp.azure.com; it is also the HTTPS
# domain Caddy gets a certificate for. First run installs Docker and a swap file; later runs only redeploy.
set -euo pipefail

HOST="${1:?usage: deploy.sh <vm-host> [git-ref]}"
REF="${2:-origin/main}"
KEY="${SSH_KEY:-$HOME/.ssh/reliefops_azure}"
USER_AT="${VM_USER:-azureuser}@$HOST"
HERE="$(cd "$(dirname "$0")" && pwd)"
REMOTE=/opt/reliefops
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER_AT")

[ -f "$HERE/.env.prod" ] || { echo "missing $HERE/.env.prod (copy env.prod.example and fill it in)" >&2; exit 1; }
git rev-parse --verify --quiet "$REF^{commit}" >/dev/null || { echo "unknown git ref: $REF" >&2; exit 1; }

echo "== 1/4 server setup (Docker, swap): skipped if already done"
"${SSH[@]}" 'bash -s' <<'SETUP'
set -euo pipefail
if ! command -v docker >/dev/null; then
  sudo apt-get update -q
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io docker-compose-v2
  sudo systemctl enable --now docker
fi
if [ ! -f /swapfile ]; then # 1 GB RAM VMs need swap to build the image and to OCR large scans
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
sudo mkdir -p /opt/reliefops && sudo chown "$USER" /opt/reliefops
SETUP

echo "== 2/4 upload backend at $REF ($(git rev-parse --short "$REF")) and the stack files"
git archive --format=tar "$REF" backend \
  | "${SSH[@]}" "rm -rf $REMOTE/backend && tar -x -C $REMOTE"
scp -q -i "$KEY" "$HERE/compose.yml" "$HERE/Caddyfile" "$USER_AT:$REMOTE/"
scp -q -i "$KEY" "$HERE/.env.prod" "$USER_AT:$REMOTE/.env.prod"
"${SSH[@]}" "chmod 600 $REMOTE/.env.prod && printf 'DOMAIN=%s\n' '$HOST' > $REMOTE/.env"

echo "== 3/4 build and start"
"${SSH[@]}" "cd $REMOTE && sudo docker compose up -d --build --remove-orphans && sudo docker image prune -f >/dev/null"

echo "== 4/4 wait for https://$HOST/api/health"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 10 "https://$HOST/api/health"; then echo; echo "live: https://$HOST"; exit 0; fi
  sleep 5
done
echo "not healthy after 150 s; logs: ssh -i $KEY $USER_AT 'cd $REMOTE && sudo docker compose logs --tail 80'" >&2
exit 1
