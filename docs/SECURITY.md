# Security review

Scope: the code in this repository as of this review — database schema and RLS, web app, admin app, mobile app, shared packages, edge function. Method: design review against the requirements, manual code review of every trust boundary, and automated tests (31 database policy tests, 22 e2e tests including security checks, unit tests for input parsers). **No external penetration test has been performed.**

## Trust model

- **Clients are untrusted.** Every client (web, admin, mobile) uses only the Supabase **anon** key plus the user's JWT. All authorization is decided by PostgreSQL RLS and security-definer functions.
- **Service role** is used only server-side in `supabase/functions/invite-member`, after re-checking the caller's rights with the same SQL function RLS uses. `createSupabase()` refuses to start if handed a service-role key.
- **Tenant id from the client is a filter, not a credential.** RLS evaluates membership for the row's `university_id`; composite foreign keys prevent cross-tenant references.
- **QR codes carry only a random token** and grant no permissions.

## Findings and controls

| Area | Control | Verified by |
|---|---|---|
| Cross-tenant reads | RLS per table; unpublished tenants invisible to outsiders | `rls.test.ts` › cross-tenant isolation, public access |
| Cross-tenant writes | `can_write(row.university_id, …)` on USING and WITH CHECK | tenant B admin cannot insert/update/delete A rows; cannot move rows between tenants |
| Cross-tenant references | Composite `(id, university_id)` foreign keys | cannot reference another tenant's floor/node |
| Role escalation | `can_assign_role`: never platform owner; owners by owners; else strictly lower rank; no self-change; memberships not directly insertable; profile trigger blocks `is_platform_owner` changes | role escalation tests (DB) + admin UI test |
| Department scoping | `can_write(…, department_id)` and course→department for timetable | department admin limited to department |
| Lecturer self-service | Row policy + trigger allowing only `office_hours`/`availability` | lecturer test |
| Tenant settings | Trigger requires `university.settings` for settings/publication/slug/data status | admin vs owner test |
| QR tokens | Not in public view/bundle/exports; audit diffs redacted; strict format check before DB; status-aware resolution; tokens ≈140-bit random, rejection-sampled | DB tests, unit tests, e2e (`never returns tokens`) |
| Malicious input | zod schemas client-side; DB check constraints; parameterised queries only (supabase-js / pg); RPC validates token regex before querying | malformed-data DB test, SQL-injection strings in RPC/API tests |
| CSV export injection | Cells starting with `= + - @ TAB CR` are prefixed with `'` | unit test |
| CSV/JSON import | Preview only; nothing written until confirmed; all rows validated; imports rebound to the current university (file's `universityId` ignored); size limits (5 MB CSV, 20 MB JSON) | unit + e2e tests |
| Unsafe uploads | SVG only, ≤ 2 MB; rejects scripts, event handlers, `foreignObject`, `javascript:`, entities/DTDs, external `href`/`url()`/`@import`; plans rendered via `<image>` (no script execution); storage policy restricts to `map.edit` in the tenant's folder and `.svg` | unit tests (8 payloads), e2e upload test |
| XSS | React escaping everywhere; the only `dangerouslySetInnerHTML` renders SVG generated locally by the `qrcode` library from a URL string; CSP `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` | review, header e2e test |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, strict referrer policy | e2e header test |
| Device permissions | Web: camera only for self; others disabled. Mobile: only `CAMERA`; microphone/location explicitly blocked; camera requested on tap only; app fully usable without it (manual code entry) | config review, e2e |
| Open redirect | `then` parameter must match `^/[A-Za-z0-9]` | e2e test |
| Rate limiting | Checkpoint API: 30 req/min/IP (in-memory); Supabase Auth has built-in auth rate limits (`config.toml`) | e2e rate-limit test |
| Audit | Trigger-written, no client write grants, readable only with `audit.read` in the tenant | DB tests |
| Secrets | No secrets in repo; `.env*` ignored; only `NEXT_PUBLIC_`/`EXPO_PUBLIC_` anon values in clients | review |
| Admin exposure | Separate app, `noindex`, sandbox disabled in production builds unless explicitly enabled | e2e header test, review |
| Privacy | No analytics or tracking; history off by default and device-local; saved places/group device-local unless signed in; lecturers' contact data limited to approved public fields | review |

## Residual risks and required actions before production

1. **Rate limiting trusts `X-Forwarded-For`.** Correct on Vercel (the platform sets it); on self-hosting, place a proxy that overwrites the header, or switch the key to the platform's client-IP header. The limiter is per instance — use the hosting firewall or a shared store for multi-instance deployments.
2. **CSP allows `'unsafe-inline'` scripts** (Next.js bootstrap without nonces). Move to nonce-based CSP via middleware when hardening further.
3. **Admin sessions use supabase-js default storage (localStorage).** Any XSS would expose tokens. Consider `@supabase/ssr` with httpOnly cookies and server-side route checks for the admin app.
4. **Floor-plan bucket is public-read.** Uploaded plans are reachable by URL even for unpublished tenants. Upload only plans the university approves for public display, or switch to a private bucket with signed URLs (trade-off: breaks long-lived offline caching).
5. **`admin_set_member_role` reveals whether an email has an account** to staff who can invite. Acceptable for staff; revisit if invite rights are broadened.
6. **The `invite-member` edge function has not been executed** in this environment (no Supabase project). Test it against a staging project before enabling.
7. **Mobile app not yet run on devices.** Permission prompts, deep links and notification behaviour must be verified on Android and iOS hardware.
8. **Translations (ckb/ar) need native-speaker review**, particularly safety-relevant strings (emergency exit, accessibility).
9. **Dependency audit**: run `pnpm audit` and enable Dependabot/Renovate on the GitHub repository.

## Security checklist (production)

- [ ] Supabase project in an appropriate region; PITR backups enabled
- [ ] Migrations applied via CI (`supabase db push`), never by hand-editing production
- [ ] RLS tests (`pnpm test:db`) green against a staging copy
- [ ] `seed.sql` **not** loaded into production
- [ ] Service-role key only in Supabase function secrets; rotated if ever exposed
- [ ] Auth: email confirmation on, minimum password length ≥ 10, leaked-password protection enabled, sign-up policy decided
- [ ] First platform owner set via SQL; at least two owners per university for continuity
- [ ] `NEXT_PUBLIC_ALLOW_SANDBOX` **unset** in production admin builds
- [ ] Custom domains with HTTPS; HSTS at the edge
- [ ] Hosting firewall/rate limits configured; X-Forwarded-For trusted only from the platform
- [ ] Floor plans reviewed for public release before upload
- [ ] Lecturer data limited to approved public fields; photo consent recorded
- [ ] Dependabot/Renovate on; `pnpm audit` clean of high/critical issues
- [ ] Mobile: store privacy labels list camera use only; no tracking
