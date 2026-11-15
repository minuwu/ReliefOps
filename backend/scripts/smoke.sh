#!/usr/bin/env bash
# Smoke test over real HTTP (owner: Anim; guide §8.8). Needs a running, seeded backend:
#
#   cd backend && uv run python -m app.seed && uv run fastapi run      # http://localhost:8000
#   bash scripts/smoke.sh                     # or: bash scripts/smoke.sh http://localhost:4011 (Prism proxy)
#
# Prints PASS/FAIL per check and exits non-zero if anything failed. It creates a few
# new cases; it never changes the seeded demo cases. The login rate-limit check runs
# last, because it blocks this machine's IP for 15 minutes on purpose (restart the
# server, or wait, before running the script again).

set -u
BASE="${1:-${BASE:-http://localhost:8000}}"
PY="${PYTHON:-python}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PAPER_FORM="$HERE/../eval/extraction/documents/t04_victim_report.txt"   # Galib's synthetic intake form
# Windows curl can't read Git Bash paths like /e/...; give it a C:/... style path there.
command -v cygpath >/dev/null 2>&1 && PAPER_FORM="$(cygpath -m "$PAPER_FORM")"
PASSWORD="Demo@1234"
CASE_42="7f3c2a9e-5b1d-4c8e-9a10-2d6f8b4e1c33"   # RFR-2026-00042, bank_b, owned by victim1
failures=0
checks=0

jget() {  # jget data.items.0.id  <<< "$json"
  "$PY" -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d[int(k)] if k.isdigit() else d[k]
print(d if not isinstance(d, (dict, list)) else json.dumps(d))' "$1"
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }
check() {  # check "name" expected actual
  checks=$((checks + 1))
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (expected $2, got $3)"; failures=$((failures + 1)); fi
}
login() {
  body -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" | jget data.token
}
json_post() { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H 'Content-Type: application/json' -d "$3"; }

echo "Smoke test against $BASE"

# ---------------------------------------------------------------- reference and login
check "health is up with the database" "ok" "$(body "$BASE/api/health" | jget data.db)"
check "five banks" "5" "$(body "$BASE/api/banks" | "$PY" -c 'import json,sys; print(len(json.load(sys.stdin)["data"]))')"
OP=$(login operator1@opscenter.test); SUP=$(login supervisor@opscenter.test)
VA=$(login viewer@bank-a.test); VB=$(login viewer@bank-b.test); V1=$(login victim1@mail.test)
check "operator logs in" "operator" "$(body "$BASE/api/auth/me" -H "Authorization: Bearer $OP" | jget data.role)"
check "victim3 must verify the email first" "403" "$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"victim3@mail.test\",\"password\":\"$PASSWORD\"}")"

# ---------------------------------------------------------------- bank isolation and roles
check "no token is 401" "401" "$(code "$BASE/api/cases")"
check "victim on a staff route is 403" "403" "$(code "$BASE/api/cases" -H "Authorization: Bearer $V1")"
check "bank_a viewer can't see a bank_b case (404)" "404" "$(code "$BASE/api/cases/$CASE_42" -H "Authorization: Bearer $VA")"
check "bank_b viewer opens their own case" "200" "$(code "$BASE/api/cases/$CASE_42" -H "Authorization: Bearer $VB")"
VB_BANKS=$(body "$BASE/api/cases?page_size=100&bank_id=bank_a" -H "Authorization: Bearer $VB" \
  | "$PY" -c 'import json,sys; print(",".join(sorted({c["bank_id"] for c in json.load(sys.stdin)["data"]["items"]})))')
check "bank_b viewer's list is bank_b only, even when asking for bank_a" "bank_b" "$VB_BANKS"
check "victim1 reads their own chat" "200" "$(code "$BASE/api/victim/cases/$CASE_42/chat" -H "Authorization: Bearer $V1")"

# ---------------------------------------------------------------- happy path: a phone case through its life
CASE_JSON=$(json_post /api/cases "$OP" '{"bank_id":"bank_b","channel":"phone","victim":{"name":"Smoke Victim","phone":"+81-90-0000-0909"},"amount":120000,"transfer_date":"2026-11-01","account_number":"5550909","scam_type":"phishing"}')
CASE=$(echo "$CASE_JSON" | jget data.id)
check "operator creates a phone case" "received" "$(echo "$CASE_JSON" | jget data.status)"
check "it still needs a document" '["document"]' "$(echo "$CASE_JSON" | jget data.flags.missing_fields)"
V=$(echo "$CASE_JSON" | jget data.version)
check "can't leave Received without a document (422)" "422" "$(code -X POST "$BASE/api/cases/$CASE/transition" \
  -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' -d "{\"to_status\":\"verified\",\"expected_version\":$V}")"
PATCHED=$(curl -s -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" -H 'Content-Type: application/json' \
  -d "{\"amount\":125000,\"victim\":{\"email\":\"smoke@mail.test\"},\"expected_version\":$V}")
check "edit bumps the version" "$((V + 1))" "$(echo "$PATCHED" | jget data.version)"
check "an old version is 409 STALE_CASE" "409" "$(code -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" \
  -H 'Content-Type: application/json' -d "{\"amount\":1,\"expected_version\":$V}")"
V=$((V + 1))
check "operator can't close as rejected (403)" "403" "$(code -X POST "$BASE/api/cases/$CASE/transition" -H "Authorization: Bearer $OP" \
  -H 'Content-Type: application/json' -d "{\"to_status\":\"closed\",\"closure_reason\":\"rejected\",\"note\":\"x\",\"expected_version\":$V}")"
check "operator assigns themselves" "Operator One" "$(json_post "/api/cases/$CASE/assign" "$OP" \
  '{"operator_id":"11111111-1111-4111-8111-111111111111"}' | jget data.assigned_operator.name)"
V=$((V + 1))
check "a note is added" "201" "$(code -X POST "$BASE/api/cases/$CASE/notes" -H "Authorization: Bearer $OP" \
  -H 'Content-Type: application/json' -d '{"body":"Smoke test note"}')"
CLOSED=$(json_post "/api/cases/$CASE/transition" "$OP" "{\"to_status\":\"closed\",\"closure_reason\":\"withdrawn\",\"note\":\"Smoke test\",\"expected_version\":$V}")
check "operator closes it as withdrawn" "closed" "$(echo "$CLOSED" | jget data.status)"
check "a closed case is read-only (409)" "409" "$(code -X PATCH "$BASE/api/cases/$CASE" -H "Authorization: Bearer $OP" \
  -H 'Content-Type: application/json' -d "{\"amount\":1,\"expected_version\":$((V + 1))}")"

# ---------------------------------------------------------------- the demo flow (guide §8.8 step 3): paper → AI → person → Verified
PAPER=$(json_post /api/cases "$OP" '{"bank_id":"bank_b","channel":"paper","victim":{"name":"Paper Victim"}}' | jget data.id)
DOC_JSON=$(curl -s -X POST "$BASE/api/cases/$PAPER/documents" -H "Authorization: Bearer $OP"   -F "file=@$PAPER_FORM;type=text/plain" -F "doc_type=intake_form")
DOC=$(echo "$DOC_JSON" | jget data.id)
check "upload the scanned paper form" "intake_form" "$(echo "$DOC_JSON" | jget data.doc_type)"
check "bank_a viewer can't download it (404)" "404" "$(code "$BASE/api/documents/$DOC/file" -H "Authorization: Bearer $VA")"
EXT_JSON=$(curl -s -X POST "$BASE/api/documents/$DOC/extract" -H "Authorization: Bearer $OP")   # no body (contract)
EXT=$(echo "$EXT_JSON" | jget data.id)
check "AI extraction waits for a person (never changes the case itself)" "pending_review" "$(echo "$EXT_JSON" | jget data.status)"
check "it shows up in the review queue" "yes" "$(body "$BASE/api/review-queue?page_size=100" -H "Authorization: Bearer $OP"   | "$PY" -c "import json,sys; print('yes' if any(i['extraction_id']=='$EXT' for i in json.load(sys.stdin)['data']['items']) else 'no')")"
PV=$(body "$BASE/api/cases/$PAPER" -H "Authorization: Bearer $OP" | jget data.version)
REVIEW=$(json_post "/api/extractions/$EXT/review" "$OP" "{\"decision\":\"accept\",\"expected_version\":$PV,\"fields\":{\"victim_phone\":\"+81-90-0000-0102\",\"amount\":250000,\"transfer_date\":\"2026-10-28\",\"account_number\":\"0012345\",\"scam_type\":\"impersonation\"}}")
check "a person accepts the fields" "accepted" "$(echo "$REVIEW" | jget data.extraction.status)"
check "nothing is missing any more" "[]" "$(body "$BASE/api/cases/$PAPER" -H "Authorization: Bearer $OP" | jget data.flags.missing_fields)"
check "reviewing it twice is 409 ALREADY_REVIEWED" "409" "$(code -X POST "$BASE/api/extractions/$EXT/review" -H "Authorization: Bearer $OP"   -H 'Content-Type: application/json' -d "{\"decision\":\"reject\",\"note\":\"x\",\"expected_version\":$((PV + 1))}")"
PV=$(body "$BASE/api/cases/$PAPER" -H "Authorization: Bearer $OP" | jget data.version)
check "the paper case moves to Verified" "verified" "$(json_post "/api/cases/$PAPER/transition" "$OP"   "{\"to_status\":\"verified\",\"expected_version\":$PV}" | jget data.status)"
check "the history shows every step" "yes" "$(body "$BASE/api/cases/$PAPER/history?page_size=100" -H "Authorization: Bearer $OP"   | "$PY" -c "import json,sys; a={e['action'] for e in json.load(sys.stdin)['data']['items']}; print('yes' if {'case.created','document.uploaded','ai.review_accepted','case.status_changed'} <= a else sorted(a))")"
check "history downloads as CSV" "200" "$(code "$BASE/api/cases/$PAPER/history?format=csv" -H "Authorization: Bearer $OP")"

# ---------------------------------------------------------------- supervisor views
check "supervisor dashboard" "All banks" "$(body "$BASE/api/dashboard/stats" -H "Authorization: Bearer $SUP" | jget data.scope.label)"
check "viewer dashboard is their bank" "bank_b" "$(body "$BASE/api/dashboard/stats" -H "Authorization: Bearer $VB" | jget data.scope.bank_id)"
check "operator can't see the dashboard (403)" "403" "$(code "$BASE/api/dashboard/stats" -H "Authorization: Bearer $OP")"
check "shared-account alerts" "200" "$(code "$BASE/api/alerts/shared-accounts" -H "Authorization: Bearer $SUP")"

# ---------------------------------------------------------------- accounts
check "sign-up can't choose a role (422)" "422" "$(code -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d '{"email":"x@mail.test","password":"a-long-password","name":"X","role":"supervisor"}')"
check "sign-up answers 202" "202" "$(code -X POST "$BASE/api/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"smoke-$RANDOM$RANDOM@mail.test\",\"password\":\"a-long-password\",\"name\":\"Smoke\"}")"
OUT=$(login victim2@mail.test)
check "logout" "200" "$(code -X POST "$BASE/api/auth/logout" -H "Authorization: Bearer $OUT")"
check "the logged-out token is 401" "401" "$(code "$BASE/api/auth/me" -H "Authorization: Bearer $OUT")"

# ---------------------------------------------------------------- last: login rate limit (blocks this IP for 15 min)
CODES=""
for _ in 1 2 3 4 5 6; do
  CODES="$CODES$(code -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d '{"email":"smoke-nobody@mail.test","password":"wrong"}') "
done
check "5 wrong passwords, then 429" "401 401 401 401 401 429" "${CODES% }"

echo
echo "$((checks - failures))/$checks passed"
[ "$failures" -eq 0 ]
