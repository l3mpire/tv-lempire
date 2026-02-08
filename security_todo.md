# TODO — Code Review

## Security Issues

### 1. POST /api/config has no authentication
- **File:** `src/app/api/config/route.ts:65`
- [x] Anyone can POST to `/api/config` and overwrite all product ARR data
- [x] No session cookie check, no admin verification
- [x] The middleware (`proxy.ts`) whitelists all `/api/` paths (see #2) — intentional, API routes must return JSON errors not redirects
- **Fix:** Added `requireAdmin()` guard in POST handler (returns 403)

### 2. All API routes bypass middleware
- **File:** `src/proxy.ts:6`
- [x] `PUBLIC_PATHS` includes `/api/`, making every API route public at middleware level — by design: middleware does browser redirects, API routes need JSON 401/403 responses
- [x] Individual routes do their own auth checks, #1 fixed
- [x] Fragile pattern: any new API route is unprotected by default — mitigated by centralizing auth helpers in `src/lib/auth.ts`
- **Fix:** Added explanatory comment in `proxy.ts`, all routes now use centralized auth

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
- [x] Both define their own `createBrowserSupabase()` instead of using `getSupabaseBrowser()` from `src/lib/supabase.ts`
- [x] Creates multiple Supabase client instances and potentially multiple realtime connections
- **Fix:** Replaced local `createBrowserSupabase()` with shared `getSupabaseBrowser()` singleton in both files

### 9. `isAdmin` field name mismatch (camelCase vs snake_case)
- **File:** `src/app/ChatOverlay.tsx:71`
- [x] ChatOverlay reads `data.user.isAdmin` (camelCase) — `/api/auth/me` already maps `is_admin` → `isAdmin` at response level
- [x] No mismatch: already correct

### 10. Video reorder: N sequential DB queries, not atomic
- **File:** `src/app/api/videos/route.ts:160-169`
- [x] Reordering fires one `UPDATE` per video in a `for` loop
- [x] Slow with many videos, not atomic — failure partway through leaves positions inconsistent
- **Fix:** Replaced sequential loop with `Promise.all` for parallel execution. True DB transaction would require a PostgreSQL function (overkill for small video list)

### 11. `searchParams` memoized at mount only
- **File:** `src/app/page.tsx:397-400`
- [x] Empty dependency array means URL changes after mount are never reflected
- **Status:** Won't fix — only used for `?tv` flag which never changes during session

### 12. Dead `localStorage` fallback in dashboard
- **File:** `src/app/page.tsx:474-479`
- [x] Config fetch checked `localStorage` for `arr-config` before API call
- [x] Nothing ever wrote to `localStorage` with this key — dead code path
- **Fix:** Removed dead localStorage check, config now always fetches from API

### 13. `useEffect` missing deps warning suppressed
- **File:** `src/app/page.tsx:459`
- [x] The config/videos/prefs fetch effect has `[]` deps — intentional mount-only fetch
- **Status:** Won't fix — `tvMode` and `buildPlaylist` are stable after mount

## Architecture / Code Quality

### 14. `page.tsx` is ~900 lines
- **File:** `src/app/page.tsx`
- [x] Components are already well-isolated (`memo`, `forwardRef`), state is interconnected — splitting would add prop drilling without real gain
- **Status:** Won't fix — manageable size, single maintainer

### 15. Duplicated type definitions
- [x] `ProductConfig` and `Config` types were copy-pasted across 4 files
- **Fix:** Created `src/lib/types.ts` with shared `ProductConfig` and `Config` types, all 4 files now import from there

### 16. `NewsTicker` duplicated rendering block
- **File:** `src/app/NewsTicker.tsx:173-203`
- [x] Message list was rendered twice (for seamless scroll loop) with identical JSX
- [x] If either copy diverged, the ticker would glitch
- **Fix:** Unified into a single `[false, true].map()` loop — one source of truth for both copies

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
| 2 | `/api/` middleware bypass | Security | Done — by design, documented |

### P1 — Bugs (broken or silently wrong behavior)

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 9 | `isAdmin` camelCase vs snake_case mismatch | Bug | Not a bug (already correct) |
| 8 | Duplicate Supabase clients (extra connections) | Bug | Done |
| 12 | Dead `localStorage` fallback | Bug | Done |
| 10 | Video reorder not atomic | Bug | Done |

### P2 — Code quality (maintainability, DX)

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 17 | `SESSION_COOKIE` duplicated | DX | Done |
| 15 | Duplicated type definitions | DX | Done |
| 14 | `page.tsx` ~900 lines | DX | Won't fix |
| 16 | `NewsTicker` duplicated JSX | DX | Done |
| 13 | `useEffect` missing deps | DX | Won't fix |
| 11 | `searchParams` stale after mount | DX | Won't fix |
| 18 | Missing `cursor-pointer` | DX | Done |

### P3 — Won't fix / Already safe

| # | Issue | Category | Status |
|---|-------|----------|--------|
| 5 | URL protocol validation | Security | Already safe (regex enforces `https?://`) |
