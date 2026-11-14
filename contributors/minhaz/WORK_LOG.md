# Minhaz's Work Log

Owner: Minhaz (`minuwu`) — Role: Frontend / Full-Stack / Architecture — Branches: `minhaz/*`

Use this log to share progress, planned work, and dependencies with the team. Update it after each work session, keep the newest entry first, and use Bangladesh time (UTC+6). Link to relevant issues, commits, or pull requests when available.

## 2026-11-14 (evening) — repo quality pass

### Completed
- Repo-wide cleanup: all doc links relative (were absolute `file:///` paths that only worked on one machine); removed `initial.md` and the `minhaz.md` stub.
- Contributor logs moved to `contributors/<name>/WORK_LOG.md` with `contributors/_template/` for newcomers.
- `AGENTS.md` rewritten: Step 0 (XREQ) + Step 1 (mandatory skills) + Step 2 (graphify first); fake `XREQ-001` proof replaced by a labelled example; `USE_MOCK` toggle bug fixed; branch rule `<name>/<topic>` → PR, no direct `main` pushes.
- Agent pointer files added: `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/agents.mdc`, `.github/copilot-instructions.md`.
- 13 skills installed into `.claude/skills/` (pinned in `skills-lock.json`); catalog + routing in `docs/SKILLS.md`.
- `docs/API_SPEC.md` made self-consistent (every endpoint uses the envelope; status legend added).
- `.gitignore` fixed (no longer ignores `lib/`; graphify machine-specific files excluded), `.gitattributes` added (LF for hooks/scripts).
- Pre-push hook hardened: decides per pushed ref (stdin), blocks any push to `main`, refuses dirty tree, re-pushes only merged branches.
- `scripts/setup.sh` / `scripts/setup.ps1` one-shot onboarding; `TEAM_INSTRUCTIONS.md` now a real human guide with per-person checklists.
- Knowledge graph built with graphify (`graphify-out/`), committed for agent use.

### Next
- Hour-0: scaffold `frontend/` with env-driven mock toggle; deploy hello-world to Vercel.
- Agree stack with Asif (HACKATHON_PRESETUP §2) and fill `docs/API_SPEC.md` with real endpoints.

### Blockers / handoff
- Asif: run `scripts/setup`, read `AGENTS.md` §4.2 and `docs/SKILLS.md`, scaffold `backend/` with CORS + `/api/health`.

### Related issues / commits / PRs
- [AGENTS.md](../../AGENTS.md) · [docs/SKILLS.md](../../docs/SKILLS.md) · [TEAM_INSTRUCTIONS.md](../../TEAM_INSTRUCTIONS.md)

---

## 2026-11-14

### Completed
- Established repository architecture, pre-setup guide, and automated pre-push sync hooks.
- Designed and authored the Cross-Functional Team Protocol and Coding Agent Operating Standard in [AGENTS.md](../../AGENTS.md).
- Organized repository documentation, plan artifacts (`docs/plans/`), and API contract blueprint (`docs/API_SPEC.md`).
- Initialized contributor work log and workflow alignment.

### Next
- Coordinate with backend team (Asif) on project domain models and initial API contracts.
- Scaffold frontend client architecture with mock toggle.

### Blockers / handoff
- No active blockers.
- Cross-functional requests will be tracked via `XREQ` entries in [AGENTS.md](../../AGENTS.md).

### Related issues / commits / PRs
- [AGENTS.md](../../AGENTS.md)
- [HACKATHON_PRESETUP.md](../../HACKATHON_PRESETUP.md)
- [docs/plans/cross-functional-protocol-plan.md](../../docs/plans/cross-functional-protocol-plan.md)

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
