# TODO — Code Review

## Security Issues

### 1. POST /api/config has no authentication
- **File:** `src/app/api/config/route.ts:65`
- Anyone can POST to `/api/config` and overwrite all product ARR data
- No session cookie check, no admin verification
- The middleware (`proxy.ts`) whitelists all `/api/` paths

### 2. All API routes bypass middleware
- **File:** `src/proxy.ts:6`
- `PUBLIC_PATHS` includes `/api/`, making every API route public at middleware level
- Individual routes do their own auth checks, but some forget (see #1)
- Fragile pattern: any new API route is unprotected by default

### 3. Session = raw user UUID in cookie
- **File:** `src/app/api/auth/login/route.ts:88`
- Session cookie contains the user's database UUID directly
- If UUIDs are predictable or leaked (e.g. via API responses), an attacker can forge a session
- A cryptographic session token would be safer

### 4. Cron endpoint auth bypass when env vars missing
- **File:** `src/app/api/cron/refresh-holistics/route.ts:50`
- `if (cronSecret && adminPassword && !authorized)` — if either env var is not set, auth check is skipped
- In dev or misconfigured environments, anyone can trigger the Holistics sync

### 5. Chat messages: no URL protocol validation
- **Files:** `src/app/ChatOverlay.tsx`, `src/app/LinkedContent.tsx`
- `LinkedContent` creates `<a href={...}>` links from user input
- The URL regex doesn't validate the protocol (e.g. `javascript:` URLs)

### 6. User name injected into HTML emails without escaping
- **Files:** `src/app/api/auth/signup/route.ts:90`, `src/app/api/admin/users/route.ts:94`
- `html: \`<p>Hi ${name.trim()},</p>\`` — name interpolated directly into HTML
- A name like `<script>alert(1)</script>` would be injected into the email

### 7. No rate limiting on auth endpoints
- **File:** `src/app/api/auth/login/route.ts`
- Login attempts are logged but not rate-limited, brute-force attacks are possible
- Signup endpoint also has no rate limiting beyond email domain check

## Bugs & Logic Issues

### 8. Duplicate Supabase client creation
- **Files:** `src/app/ChatOverlay.tsx:30-36`, `src/app/NewsTicker.tsx:16-21`
- Both define their own `createBrowserSupabase()` instead of using `getSupabaseBrowser()` from `src/lib/supabase.ts`
- Creates multiple Supabase client instances and potentially multiple realtime connections

### 9. `isAdmin` field name mismatch (camelCase vs snake_case)
- **File:** `src/app/ChatOverlay.tsx:71`
- ChatOverlay reads `data.user.isAdmin` (camelCase) but `/api/auth/me` likely returns `is_admin` (snake_case from Supabase)
- If mismatched, chat admin features (delete others' messages, breaking news) silently break

### 10. Video reorder: N sequential DB queries, not atomic
- **File:** `src/app/api/videos/route.ts:177-185`
- Reordering fires one `UPDATE` per video in a `for` loop
- Slow with many videos, not atomic — failure partway through leaves positions inconsistent
- Should use a single batch or transaction

### 11. `searchParams` memoized at mount only
- **File:** `src/app/page.tsx:410-413`
- Empty dependency array means URL changes after mount are never reflected
- Fine for initial `?tv` param but could be confusing if dynamic behavior is expected

### 12. Dead `localStorage` fallback in dashboard
- **File:** `src/app/page.tsx:474-479`
- Config fetch checks `localStorage` for `arr-config` before API call
- Nothing ever writes to `localStorage` with this key — dead code path
- If someone manually sets that key, it silently short-circuits the API fetch

### 13. `useEffect` missing deps warning suppressed
- **File:** `src/app/page.tsx:519`
- The config/videos/prefs fetch effect has `[]` deps but uses `tvMode` and `buildPlaylist`
- Intentional but fragile

## Architecture / Code Quality

### 14. `page.tsx` is 919 lines
- **File:** `src/app/page.tsx`
- Contains video player, help popup, ambient background, product card, formatting utilities, and full dashboard layout
- Should be split into smaller modules

### 15. Duplicated type definitions
- `ProductConfig` and `Config` types are copy-pasted across:
  - `src/app/page.tsx`
  - `src/app/admin/page.tsx`
  - `src/app/api/config/route.ts`
  - `src/app/api/cron/refresh-holistics/route.ts`
- A shared types file would reduce drift

### 16. `NewsTicker` duplicated rendering block
- **File:** `src/app/NewsTicker.tsx:173-203`
- Message list is rendered twice (for seamless scroll loop) with identical JSX
- If either copy diverges, the ticker will glitch
- Extracting a `TickerItems` component would prevent accidental divergence

### 17. `SESSION_COOKIE` constant duplicated in 6+ files
- Defined as `"dashboard_session"` in:
  - `src/proxy.ts`
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/signup/route.ts`
  - `src/app/api/auth/logout/route.ts`
  - `src/app/api/messages/route.ts`
  - `src/app/api/videos/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/preferences/route.ts`
  - `src/app/api/auth/me/route.ts`
- Should be a shared constant

### 18. Missing `cursor-pointer` on admin buttons
- **File:** `src/app/admin/page.tsx`
- Several buttons (Verify, Remove admin, Delete) lack explicit cursor styling
