# feat: Advanced audit log, ORGUSD Soroban contract & standardized API errors

This PR resolves four open issues across the backend and smart-contract layers of PayD.

Closes #696
Closes #186
Closes #187
Closes #341

## Summary of Changes

### Issue #696 — Advanced Audit Log for All Admin Actions (backend)

- **`backend/src/db/migrations/048_create_admin_audit_log.sql`** — New append-only `admin_audit_log` table with 6 covering indexes, PostgreSQL rules preventing UPDATE/DELETE, and JSONB `old_state`/`new_state` columns for diff-style auditing.
- **`backend/src/services/adminAuditService.ts`** — Service with `log()`, `list()` (multi-filter pagination by action type, resource type, actor, severity, date range), `summary()` (aggregated counts for dashboards), and `exportCsv()` (up to 10 000 rows).
- **`backend/src/routes/adminAuditRoutes.ts`** — `GET /api/v1/admin-audit` (list), `/summary`, and `/export` behind EMPLOYER JWT + org-isolation guards with Swagger docs.
- **`backend/src/middlewares/adminAuditMiddleware.ts`** — `auditAction()` factory: fire-and-forget middleware that wraps any mutating route and appends a structured audit entry without blocking the response path.
- **`backend/src/routes/v1/index.ts`** — Register `/admin-audit` under `dataRateLimit`.
- **`backend/src/services/__tests__/adminAuditService.test.ts`** — Unit tests for all service methods including filter combinations, CSV escaping, and error swallowing.

### Issues #186 / #187 — ORGUSD Custom Asset on Stellar Testnet (Soroban contract)

- **`contracts/orgusd/Cargo.toml`** — Package manifest inheriting workspace version, authors, and license.
- **`contracts/orgusd/src/lib.rs`** — Full Soroban contract implementing:
  - `initialize(admin)` — one-shot setup
  - `authorize(account)` / `revoke(account)` — mirrors Stellar `auth_required`/`auth_revocable`
  - `freeze(account)` / `unfreeze(account)` — regulatory hold
  - `mint(to, amount)` — admin-only issuance
  - `transfer(from, to, amount)` — with auth, dual active-account checks, self-transfer guard
  - `burn(from, amount)` / `clawback(from, amount)` — holder and admin token destruction
  - SEP-0034 metadata (`name`, `version`, `author`)
  - Typed `#[contracterror]` enum (9 variants) and `#[contractevent]` for every state transition
  - 20 unit tests covering the full issuance flow and all error paths
- **`Cargo.toml`** — Added `contracts/orgusd` to workspace members.

### Issue #341 — Standardize API Error Response Format (backend)

- **`backend/src/middlewares/errorHandlerMiddleware.ts`** — Central Express error handler that maps every error type to the canonical shape `{ code, message, details, requestId }`:
  - `ZodError` → 400 `VALIDATION_ERROR` with per-field details
  - HTTP-tagged errors → status passthrough, code inferred from status or `err.code`
  - `TypeError` / `RangeError` / `SyntaxError` → 400 `BAD_REQUEST`
  - Unhandled errors → 500 `INTERNAL_ERROR` (message redacted in production)
- **`backend/src/app.ts`** — Replace the inline catch-all handler with `errorHandlerMiddleware`.
- **`backend/src/__tests__/errorHandlerMiddleware.test.ts`** — 18 integration tests covering all error categories, production/development message visibility, non-Error thrown values, and shape compliance.

## Test Plan

- [ ] `cd backend && npm test` — all existing tests pass; `adminAuditService.test.ts` and `errorHandlerMiddleware.test.ts` pass
- [ ] Apply migration `048_create_admin_audit_log.sql` against a local database; confirm table, indexes, and rules are created
- [ ] `GET /api/v1/admin-audit` with a valid EMPLOYER JWT → `{ success: true, data: [], total: 0 }`
- [ ] `GET /api/v1/admin-audit/summary` → `{ success: true, data: { totalActions: 0, ... } }`
- [ ] `GET /api/v1/admin-audit/export` → `text/csv` with correct header row
- [ ] Trigger a Zod validation failure → response body matches `{ code: "VALIDATION_ERROR", details: [...] }`
- [ ] Trigger a 404 → `{ code: "NOT_FOUND", message: "...", details: [] }`
- [ ] `cargo test -p orgusd` — all 20 contract unit tests pass (requires Soroban toolchain)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
