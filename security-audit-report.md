# Security Audit Report

**Project**: Orbita-Frontend (apps/api + apps/web)
**Date**: 2026-08-16
**Auditor**: Claude Security Audit
**Frameworks**: OWASP Top 10:2025 + NIST CSF 2.0
**Mode**: focus:auth

---

## Executive Summary

| Metric | Count |
|--------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 1 |
| 🟡 Medium | 2 |
| 🟢 Low | 3 |
| 🔵 Informational | 1 |
| 📍 Security hotspots | 1 |
| **Total findings** | **8** |

**Overall Risk Assessment**: The core authentication engine (`apps/api/src/auth/auth.service.ts`, `auth.guard.ts`) is solid — argon2id hashing, hashed/rotated refresh tokens with reuse-window handling, per-tenant JWT re-validation on every request, account lockout, rate-limited password-reset codes that don't leak account existence, and a properly server-verified Google OAuth flow. The frontend keeps the access token in memory (not localStorage) and the refresh token in an httpOnly cookie, which is the right baseline pattern. The one substantive issue is architectural: the refresh cookie is intentionally shared across all `*.orbita.site` subdomains for a legitimate cross-subdomain login handoff, but the BFF hands the resulting access token back in a JSON response to whatever origin's script requested it — meaning any current or future way to run JS under an attacker-controlled tenant subdomain (stored XSS in tenant content, or a future marketing-pixel/custom-script feature) escalates from "single tenant compromised" to "any logged-in business owner's session stealable platform-wide."

---

## OWASP Top 10:2025 Coverage (scope: auth only)

| OWASP ID | Category | Findings | Status |
|----------|----------|----------|--------|
| A01:2025 | Broken Access Control | 1 | 🔴 Needs Attention |
| A02:2025 | Security Misconfiguration | 3 | 🟡 Needs Attention |
| A04:2025 | Cryptographic Failures | 1 | 🔵 Acceptable (hardening only) |
| A07:2025 | Authentication Failures | 3 | 🟡 Needs Attention |

---

## 🟠 High Findings

### 🟠 [HIGH-001] Cross-subdomain refresh cookie + JSON token echo turns any tenant-side script execution into platform-wide account takeover
- **Severity**: 🟠 HIGH
- **OWASP**: A01:2025 (Broken Access Control)
- **CWE**: CWE-284 (Improper Access Control), CWE-1275 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute family — cross-domain cookie scope)
- **NIST CSF**: PR.AA (Identity Management, Authentication and Access Control)
- **Location**:
  - `apps/web/src/lib/auth/bff.ts:53-59` (`cookieDomain()` — scopes cookie to `.${ROOT_DOMAIN}`, i.e. `.orbita.site` in prod, shared across every tenant subdomain)
  - `apps/web/src/pages/api/auth/refresh.ts:20,50-53` (reads the shared cookie, returns the raw access `token` in the JSON body to the calling script)
  - `apps/api/src/auth/auth.service.ts:289-327` (`refresh()` never checks the caller's tenant context against `stored.businessId`)
- **Attack Vector**:
  1. The `orbita_refresh_panel` cookie is deliberately set with `Domain=.orbita.site` so a business owner landing on `{their-slug}.orbita.site/panel` can recover their session (documented intent in `bff.ts:47-51` and `refresh.ts:6-11`).
  2. Because the cookie's `Domain` is the whole platform, it is attached by the browser to a request from **any** `*.orbita.site` origin — including a subdomain fully controlled by an unrelated tenant (self-service `onboarding.service.ts` lets anyone create one).
  3. `POST /api/auth/refresh` is the same Next.js route regardless of which subdomain serves it. It reads whichever `orbita_refresh_panel`/`orbita_refresh_customer` cookie the browser sent and forwards it to the real backend, which rotates it and returns a fresh JWT — with no check that the request actually originated from the tenant the token belongs to.
  4. The route then returns that JWT **in the JSON response body** (`refresh.ts:53`, `return res.status(200).json(rest) // { token }`) — directly readable by whatever JavaScript made the `fetch()` call.
  5. If an attacker (any registered tenant) can get JavaScript to run under their own subdomain — today this would require a stored-XSS in tenant-rendered content (product descriptions, reviews, message templates); tomorrow it could be as simple as a "add tracking pixel / custom script" storefront feature — that script only needs to call `fetch('/api/auth/refresh', {method:'POST', body: JSON.stringify({channel:'panel'})})`. Any victim business owner who merely *visits* that tenant's public storefront (while their own panel session cookie is alive, which is normal — it's shared platform-wide) has their live access token exfiltrated to the attacker's script, for whichever business they actually manage.
  6. This defeats the purpose of storing the refresh token `HttpOnly` in the first place: the attacker never needs to read the cookie — the server reads it for them and hands back the bearer token.
- **Impact**: Full session takeover of any business owner (member) or customer whose browser carries the shared cookie, from a completely different, attacker-owned tenant — i.e. horizontal privilege escalation across tenant boundaries, the exact failure mode the rest of the auth system (`AuthGuard` re-validating `businessId` on every request, per-tenant credential isolation) is designed to prevent. Severity is capped at High rather than Critical because it currently requires a second primitive (script execution under the attacker's own subdomain) that was not found to exist yet in this codebase (no `dangerouslySetInnerHTML` of tenant content, no custom-script/pixel feature was found in the storefront).
- **Remediation** (description only — no code fixes; re-run with `--fix` for code-level patches): Two independent, complementary options:
  1. Stop sharing the raw bearer response across origins: make the "handoff" exchange **single-use and scoped**, the same pattern already used for Google OAuth (`google-oauth-exchange.store.ts`) — mint a short-lived, single-use exchange code server-side when the cookie is minted, and have `/api/auth/refresh` only accept a request that also proves it belongs to the current tenant (e.g. validate `X-Business-Slug` against the token's stored `businessId` before returning anything, mirroring what `AuthGuard.resolveAuthContext()` already does for regular authenticated requests).
  2. Independently, treat this as defense-in-depth: any stored-XSS in tenant-controlled content becomes far more dangerous under the current design than it would be with a host-only cookie, so prioritize output-encoding review of tenant-supplied fields (product descriptions, reviews, message templates, business/store names) and add a CSP (see MEDIUM-001) to reduce the odds the second primitive ever becomes available.

---

## 🟡 Medium Findings

### 🟡 [MEDIUM-001] No security headers (helmet/CSP) configured
- **Severity**: 🟡 MEDIUM
- **OWASP**: A02:2025 (Security Misconfiguration)
- **CWE**: CWE-1021 (Improper Restriction of Rendered UI Layers, i.e. missing clickjacking protection), CWE-693 (Protection Mechanism Failure)
- **NIST CSF**: PR.PS (Platform Security)
- **Location**: `apps/api/src/main.ts` — bootstrap sets CORS, JSON/urlencoded body limits and global validation, but no `helmet()` (package isn't even a dependency) and no CSP is set anywhere.
- **Attack Vector**: No `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Content-Security-Policy` headers are emitted by the API. This doesn't create a vulnerability by itself, but removes a layer of defense (especially CSP) that would otherwise blunt the impact of HIGH-001 and any future stored-XSS.
- **Remediation**: Add `helmet()` to the Nest bootstrap with a CSP tuned for the storefront's actual asset origins, plus `frame-ancestors 'none'` (or an explicit allowlist) for the panel.

### 🟡 [MEDIUM-002] Login/registration rate limiting is IP-only (already a known, accepted gap)
- **Severity**: 🟡 MEDIUM
- **OWASP**: A07:2025 (Authentication Failures)
- **CWE**: CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **NIST CSF**: PR.AA, DE.CM
- **Location**: `apps/api/src/app.module.ts:53` (global `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])`), `apps/api/src/auth/auth.controller.ts:36` (`@Throttle` on `login` is also IP-keyed by default).
- **Attack Vector**: Per-account lockout (`LOCKOUT_THRESHOLD = 5`) is solid against a single-account brute force. But a distributed attacker spraying low-and-slow credential-stuffing attempts (≤4 guesses per account, many accounts, or rotating source IPs) stays under both the per-account lockout and the per-IP throttle. The code already flags this itself (`auth.controller.ts:55-56`: "ThrottlerGuard global no tiene tracker combinado IP+email en este proyecto").
- **Remediation**: Add a combined IP+email (or email-only) tracker for the login/forgot-password/reset endpoints so a spray across many accounts from many IPs is still caught; this was already identified internally, so treat this finding as confirmation it's worth prioritizing rather than a new discovery.

---

## 🟢 Low Findings

### 🟢 [LOW-001] No password ceiling / breached-password check
- **OWASP**: A07:2025 | **CWE**: CWE-521 (Weak Password Requirements) | **NIST**: PR.AA
- **Location**: `apps/api/src/auth/dto/register.dto.ts:9-11`, `reset-password.dto.ts:11-13` — only `@MinLength(8)`, no `@MaxLength`, no breached-password check.
- Recommend adding a reasonable `@MaxLength` (e.g. 128) to bound argon2 hashing cost per request, and consider checking new passwords against a breached-password corpus (NIST 800-63B) instead of relying on length alone.

### 🟢 [LOW-002] `LoginDto` password validator is weaker than `RegisterDto`'s
- **OWASP**: A07:2025 | **CWE**: CWE-521 | **NIST**: PR.AA
- **Location**: `apps/api/src/auth/dto/login.dto.ts:12` — `@MinLength(6)` vs. 8 at registration/reset. Doesn't weaken what's stored (still argon2id-hashed at registration time with the 8-char rule), just an inconsistency in the input validator worth tidying up.

### 🟢 [LOW-003] Dev-only CORS origins allowed unconditionally
- **OWASP**: A02:2025 | **CWE**: CWE-16 (Configuration) | **NIST**: PR.PS
- **Location**: `apps/api/src/main.ts:26-35` — `http://localhost:3000` / `:3001` are always in the CORS allowlist, not gated by `NODE_ENV`. Low impact (only permits requests *from* an origin running on the visitor's own machine), but unnecessary in a production deployment.

---

## 🔵 Informational Findings

### 🔵 [INFO-001] No minimum-strength assertion on `JWT_SECRET` at boot
- **OWASP**: A04:2025 (Cryptographic Failures, hardening) | **CWE**: CWE-330 (weak randomness/strength of a security-critical value, applied to config) | **NIST**: PR.DS
- **Location**: `apps/api/src/auth/auth.service.ts:67` — `this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET')` fails closed if the var is *missing*, but does not validate length/entropy if it's *present but weak*.
- Verified this is not an active leak: `apps/api/.env` (which currently holds the literal placeholder text `"generar con: openssl rand -hex 32"`, not a real secret) is git-ignored and has never been committed (`apps/api/.gitignore:8`, confirmed via `git log`) — this is just an unconfigured local dev environment, not a deployed secret. Still, worth asserting `jwtSecret.length >= 32` at startup so a future misconfigured deploy fails fast instead of silently signing tokens with a guessable value.

---

## 📍 Security Hotspots

### [HOTSPOT-001] `resetPassword()` already trusts a `PLATFORM_ADMIN`-typed reset token end-to-end, even though no route currently issues one
- **OWASP**: A07:2025 | **CWE**: CWE-284 | **NIST**: PR.AA
- **Location**: `apps/api/src/auth/auth.service.ts:440-467` (the `PLATFORM_ADMIN` branch of `resetPassword()`) vs. `forgotPassword()` (lines 342-377), which only ever creates `MEMBER`/`CUSTOMER` tokens today.
- **Why sensitive**: The persistence layer and `resetPassword()` already fully support resetting a platform super-admin's password via a 6-digit emailed code, with no additional factor beyond that code (unlike login, which requires a second MFA-style code on top of the password for platform admins — see `verifyPlatformAdminLoginCode`). The only reason this isn't exploitable today is that `forgotPassword()` never issues a `PLATFORM_ADMIN`-typed token, per the code's own comment ("el reset de admin queda para cuando se exponga su flujo").
- **Risk if modified**: If a future change wires up "forgot password" for platform admins without deliberately re-adding the second factor (or without noticing the asymmetry with the login flow), a platform super-admin account — which is cross-tenant and the highest-privilege identity in the system — would become resettable with just a 6-digit emailed code, a materially weaker bar than the MFA-gated login path for the same identity.
- **Review guidance**: If/when this flow is exposed, require the same second factor as `verifyPlatformAdminLoginCode` uses (or stronger), not just the reset code alone.

---

## What's Solid (verified clean)

- **Password storage**: argon2id everywhere passwords are set (`auth.service.ts:89,443,685`). No plaintext, no legacy MD5/SHA1/bcrypt-with-low-cost.
- **Tenant isolation**: `AuthGuard.resolveAuthContext()` re-queries the DB on every request with both `id` **and** `businessId` from the JWT (`auth.guard.ts:81-92,108-116`), plus a slug cross-check — a compromised/forged `sub` alone can't cross tenants.
- **Refresh tokens**: stored only as a SHA-256 hash (`hashToken`), single-use with rotation, immediate hard revocation on logout, and a narrow (30s) grace window explicitly scoped to concurrent-request races, not to tolerate reuse of a genuinely old token (`auth.service.ts:289-327`).
- **Password-reset codes / platform-admin MFA codes**: hashed, short TTL, capped attempts, and `forgotPassword()` never reveals whether an account exists.
- **Account lockout**: uniform 5-attempt/15-minute lockout across member, customer and platform_admin.
- **Google OAuth**: state is HMAC-signed with `timingSafeEqual` comparison and a short TTL+nonce (`google-auth.service.ts`); `id_token` is verified server-side (signature, audience, `email_verified`) via `google-auth-library`, never trusted from the client; the JWT itself never appears in a redirect URL (one-time server-side exchange code instead).
- **Frontend token handling**: access token kept in memory only (never `localStorage`/`sessionStorage`, per the explicit `RBT-290` comment in `authClient.ts`), refresh token in an `HttpOnly` cookie — the right baseline split, undermined only by the cross-subdomain scope covered in HIGH-001.
- **Session self-service**: list/revoke-one/revoke-all-except-current refresh-token sessions, correctly scoped to `userId`+`userType` so one user can't revoke another's session by guessing an ID.

---

## Recommendations Summary (priority order)

1. **HIGH-001** — Fix the refresh-cookie/BFF cross-tenant exposure before it matters: scope the cookie tighter and/or validate tenant context in `refresh()`, mirroring the existing OAuth exchange-code pattern.
2. **MEDIUM-002** — Add IP+email combined throttling on login/forgot-password (already flagged internally in code comments).
3. **MEDIUM-001** — Add `helmet()` + a CSP to the API.
4. **LOW-001/002/003** — Password length ceiling, consistent `MinLength` between login/registration DTOs, drop unconditional localhost CORS origins in prod.
5. **INFO-001** — Assert `JWT_SECRET` minimum length at boot.
6. **HOTSPOT-001** — Keep in mind if/when platform-admin self-service password reset ships.

---

## Methodology

| Aspect | Details |
|--------|---------|
| Phases executed | Phase 1 (Reconnaissance) + Phase 2 scoped to A01/A07 (+A02/A04 where directly relevant) + Phase 4 (auth hotspots) — `focus:auth` mode |
| Frameworks detected | NestJS (API, Prisma/PostgreSQL), Next.js (web, pages router + BFF API routes) |
| White-box categories | Broken Access Control, Authentication Failures (deep dive); Security Misconfiguration and Cryptographic Failures noted where directly touching auth |
| Gray-box testing | Not run (out of scope for `focus:auth`) |
| Security hotspots | 1 flagged (platform-admin reset code path) |
| Files reviewed | `apps/api/src/auth/*` (service, controller, google-auth service/controller, DTOs), `apps/api/src/common/guards/*` (auth, roles, permissions, platform-admin, business-mode), `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/prisma/schema.prisma` (RefreshToken/PasswordResetToken/PlatformAdminLoginCode models), `apps/web/src/lib/auth/*` (AuthContext, authClient, bff), `apps/web/src/pages/api/auth/*` |
| OWASP Top 10:2025 | 4/10 categories in scope (A01, A02, A04, A07) |
| NIST CSF 2.0 | PR (Protect) function |

---

*Report generated by Claude Security Audit*
