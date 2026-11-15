---
name: verify
description: How to verify the API contract (docs/API_SPEC.md + docs/openapi.yaml) at runtime, by driving the Prism mock the frontend builds against. Use before telling teammates the contract is ready.
---

# Verify the API contract

The contract has no backend yet. Its runtime surface is the Prism mock built from `docs/openapi.yaml`.

## Launch

```bash
npx -y @stoplight/prism-cli@5.14.2 mock docs/openapi.yaml -p 4010 > prism.log 2>&1   # run in background
curl -s --retry 30 --retry-connrefused --retry-delay 2 http://127.0.0.1:4010/api/health
```

Prism watches the file and crashes if the YAML is mid-edit. Restart it after big edits.

## Drive

1. **Every operation:** send each documented example (with `Authorization: Bearer t` where secured) and expect the lowest documented 2xx code and the `{success, data}` envelope.
2. **Prism's own log:** grep `Violation: response` in the log. It flags examples that break their schema, or operations with no example, where Prism fills in the placeholder `"string"`.
3. **Variants:** `Prefer: code=409|429|403|404` should return the documented error example. 429 should carry `Retry-After`.
4. **Consumer replay:** send the exact bodies from `frontend/src/services/api.ts` (its `USE_MOCK=false` branch). That shows contract drift from the frontend's side.

## Gotchas

- A 422 from the mock always returns the first 422 example (`victim.email ...`), not the real cause. Read the real cause in the log (`Violation: request...`).
- Malformed JSON gets no response from Prism (curl times out). Real FastAPI returns 422.
- Multipart uploads need the exact schema fields (`doc_type`; KB uploads need `bank_id`, `title`, `version` and `language`).
- `GET /api/documents/{id}/file` is binary. Send `Accept: */*` or Prism returns 406.
- Without `consent: true`, `POST /api/victim/cases` returns 422.
- The mock doesn't enforce roles or banks. Bank isolation can only be verified against the real backend.
