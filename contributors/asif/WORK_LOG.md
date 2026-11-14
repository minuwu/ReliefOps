# Asif's Work Log

Owner: Asif (`MdAsif-Hossain`) — Role: Backend / Services / Database — Branches: `asif/*`

Use this log to share progress, planned work, and dependencies with the team. Update it after each work session, keep the newest entry first, and use Bangladesh time (UTC+6). Link to relevant issues, commits, or pull requests when available.

## 2026-11-14

### Completed
- Read the Mock Hackathon #1 brief (fraud-relief case system for five banks). I own backend, database and devops.
- Wrote API contract v0.1 in [docs/API_SPEC.md](../../docs/API_SPEC.md):
  - 23 endpoints, tagged MVP / Should / Nice
  - role permissions table, status rules, error codes
  - TypeScript data types, JSON examples, seeded demo logins
  - the interface the AI module must implement
- Wrote [docs/plans/backend-plan.md](../../docs/plans/backend-plan.md):
  - decisions D1–D10
  - which endpoint covers each brief requirement
  - Postgres data model
  - bank-separation design (RLS)
  - AI failure plan
  - docker compose / env / deploy plan
  - backend milestones against the brief's checkpoints
- Created the backend skeleton `backend/app/{routers,services,models}`, following the team structure in HACKATHON_PRESETUP §3.
- Re-ran the `find-skills` install with the repo flags (`-a claude-code --copy -y`). The repo copy was already up to date; no changes.
- Branch: `asif/api-contract`.

### Next
- Get team sign-off on the open questions in backend-plan §10. These are Proposed decisions D1, D2, D4, D6, plus AI ownership and provider.
- Scaffold FastAPI (CORS, response envelope, `/api/health`), `docker-compose.yml` with Postgres, `.env.example`; deploy the hello-world.
- First Alembic migration with RLS policies and the audit trigger, then the seed script (≥ 30 cases, ≥ 10 documents).

### Blockers / handoff
- **Ready for Frontend (Minhaz):** API_SPEC v0.1. Build mocks from §4 data types and §6 examples; build order is in §5. Change requests go through an `XREQ`.
- **Ready for the AI owner:** API_SPEC §7 (the `extract_fields` interface) and backend-plan §6 (how accuracy is measured).
- Waiting on the kickoff decisions above. Work continues on the Proposed defaults until then.

### Related issues / commits / PRs
- Branch `asif/api-contract` (PR to `main` pending)

---

## 2026-11-13

### Completed
- Confirmed write access to [BJET-Hackathon](https://github.com/minuwu/BJET-Hackathon).
- Connected the local workspace to the repository on the `main` branch and configured my Git commit identity.
- Created this work log for team coordination.

### Next
- Record my first agreed project task and any dependencies on teammates before starting implementation.

### Blockers / handoff
- No blockers identified during repository setup.
- No implementation work is ready for handoff yet.

### Related issues / commits / PRs
- Add links when available.

---

## Daily entry template

Copy this template above the latest dated entry. Replace the placeholders with actual progress; keep planned work under **Next**.

```markdown
## YYYY-MM-DD

### Completed
- [Task completed and its outcome; include validation when relevant.]

### Next
- [Task I plan to take next, so teammates can avoid overlapping work.]

### Blockers / handoff
- [What I need, from whom, or what is ready for a teammate. Use "None" if applicable.]

### Related issues / commits / PRs
- [Title](link)
```
