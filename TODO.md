# TODO — Code Review

## Security Issues

### 1. POST /api/config has no authentication
- **File:** `src/app/api/config/route.ts:65`
- [x] Anyone can POST to `/api/config` and overwrite all product ARR data
- [x] No session cookie check, no admin verification
- [ ] The middleware (`proxy.ts`) whitelists all `/api/` paths (see #2)
- **Fix:** Added `requireAdmin()` guard in POST handler (returns 403)

### 2. All API routes bypass middleware
- **File:** `src/proxy.ts:6`
- [ ] `PUBLIC_PATHS` includes `/api/`, making every API route public at middleware level
- [ ] Individual routes do their own auth checks, but some forget (see #1)
- [x] Fragile pattern: any new API route is unprotected by default — mitigated by centralizing auth helpers in `src/lib/auth.ts`

### 3. Session = raw user UUID in cookie
- **File:** `src/app/api/auth/login/route.ts:88`
- [ ] Session cookie contains the user's database UUID directly
- [ ] If UUIDs are predictable or leaked (e.g. via API responses), an attacker can forge a session
- [ ] A cryptographic session token would be safer
- **Status:** Deferred — requires session table migration

### 4. Cron endpoint auth bypass when env vars missing
- **File:** `src/app/api/cron/refresh-holistics/route.ts:50`
- [x] `if (cronSecret && adminPassword && !authorized)` — if either env var is not set, auth check is skipped
- [x] In dev or misconfigured environments, anyone can trigger the Holistics sync
- **Fix:** Changed to `if (!authorized)` — always enforces auth

### 5. Chat messages: no URL protocol validation
- **Files:** `src/app/ChatOverlay.tsx`, `src/app/LinkedContent.tsx`
- [x] `LinkedContent` creates `<a href={...}>` links from user input
- [x] The URL regex requires `https?://` protocol — already safe, no `javascript:` URLs possible

### 6. User name injected into HTML emails without escaping
- **Files:** `src/app/api/auth/signup/route.ts:90`, `src/app/api/admin/users/route.ts:94,164`
- [x] `html: \`<p>Hi ${name.trim()},</p>\`` — name interpolated directly into HTML
- [x] A name like `<script>alert(1)</script>` would be injected into the email
- **Fix:** Added `escapeHtml()` utility, applied to all 3 email templates

### 7. No rate limiting on auth endpoints
- **File:** `src/app/api/auth/login/route.ts`
- [ ] Login attempts are logged but not rate-limited, brute-force attacks are possible
- [ ] Signup endpoint also has no rate limiting beyond email domain check
- **Status:** Deferred — requires middleware-level or external rate limiting (Vercel WAF, Upstash)

## Bugs & Logic Issues

### 8. Duplicate Supabase client creation
- **Files:** `src/app/ChatOverlay.tsx:30-36`, `src/app/NewsTicker.tsx:16-21`
- [ ] Both define their own `createBrowserSupabase()` instead of using `getSupabaseBrowser()` from `src/lib/supabase.ts`
- [ ] Creates multiple Supabase client instances and potentially multiple realtime connections

### 9. `isAdmin` field name mismatch (camelCase vs snake_case)
- **File:** `src/app/ChatOverlay.tsx:71`
- [x] ChatOverlay reads `data.user.isAdmin` (camelCase) — `/api/auth/me` already maps `is_admin` → `isAdmin` at response level
- [x] No mismatch: already correct

### 10. Video reorder: N sequential DB queries, not atomic
- **File:** `src/app/api/videos/route.ts:177-185`
- [ ] Reordering fires one `UPDATE` per video in a `for` loop
- [ ] Slow with many videos, not atomic — failure partway through leaves positions inconsistent
- [ ] Should use a single batch or transaction

### 11. `searchParams` memoized at mount only
- **File:** `src/app/page.tsx:410-413`
- [ ] Empty dependency array means URL changes after mount are never reflected
- [ ] Fine for initial `?tv` param but could be confusing if dynamic behavior is expected

### 12. Dead `localStorage` fallback in dashboard
- **File:** `src/app/page.tsx:474-479`
- [x] Config fetch checked `localStorage` for `arr-config` before API call
- [x] Nothing ever wrote to `localStorage` with this key — dead code path
- **Fix:** Removed dead localStorage check, config now always fetches from API

### 13. `useEffect` missing deps warning suppressed
- **File:** `src/app/page.tsx:519`
- [ ] The config/videos/prefs fetch effect has `[]` deps but uses `tvMode` and `buildPlaylist`
- [ ] Intentional but fragile

## Architecture / Code Quality

### 14. `page.tsx` is 919 lines
- **File:** `src/app/page.tsx`
- [ ] Contains video player, help popup, ambient background, product card, formatting utilities, and full dashboard layout
- [ ] Should be split into smaller modules

### 15. Duplicated type definitions
- [ ] `ProductConfig` and `Config` types are copy-pasted across:
  - `src/app/page.tsx`
  - `src/app/admin/page.tsx`
  - `src/app/api/config/route.ts`
  - `src/app/api/cron/refresh-holistics/route.ts`
- [ ] A shared types file would reduce drift

### 16. `NewsTicker` duplicated rendering block
- **File:** `src/app/NewsTicker.tsx:173-203`
- [ ] Message list is rendered twice (for seamless scroll loop) with identical JSX
- [ ] If either copy diverges, the ticker will glitch
- [ ] Extracting a `TickerItems` component would prevent accidental divergence

### 17. `SESSION_COOKIE` constant duplicated in 6+ files
- [x] Was defined as `"dashboard_session"` in 9 files
- [x] Now centralized in `src/lib/auth.ts`, all files import from there
- **Fix:** Created `src/lib/auth.ts` with shared `SESSION_COOKIE`, `requireSession()`, `requireAdmin()`, `escapeHtml()`

### 18. Missing `cursor-pointer` on admin buttons
- **File:** `src/app/admin/page.tsx`
- [x] Added `cursor-pointer` to all interactive buttons (TV toggle, Remove, Sync, Resend email, Verify, Make/Remove admin, Delete, Add video)

---

## Roadmap

### P0 — Critical (security, data integrity)

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 1 | POST /api/config unauthenticated | Security | Done |
| 4 | Cron auth bypass | Security | Done |
| 6 | XSS in emails | Security | Done |
| 3 | Session = raw UUID (forgeable) | Security | Deferred |
| 7 | No rate limiting on login/signup | Security | Deferred |
| 2 | `/api/` middleware bypass | Security | Partial — auth centralized, middleware TODO |

### P1 — Bugs (broken or silently wrong behavior)

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 9 | `isAdmin` camelCase vs snake_case mismatch | Bug | Not a bug (already correct) |
| 8 | Duplicate Supabase clients (extra connections) | Bug | Open |
| 12 | Dead `localStorage` fallback | Bug | Done |
| 10 | Video reorder not atomic | Bug | Open |

### P2 — Code quality (maintainability, DX)

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 17 | `SESSION_COOKIE` duplicated | DX | Done |
| 15 | Duplicated type definitions | DX | Open |
| 14 | `page.tsx` 919 lines | DX | Open |
| 16 | `NewsTicker` duplicated JSX | DX | Open |
| 13 | `useEffect` missing deps | DX | Open |
| 11 | `searchParams` stale after mount | DX | Open |
| 18 | Missing `cursor-pointer` | DX | Done |

### P3 — Won't fix / Already safe

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 5 | URL protocol validation | Security | Already safe (regex enforces `https?://`) |
