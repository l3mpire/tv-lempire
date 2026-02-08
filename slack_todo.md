# Bidirectional Slack Integration for TV Lempire Chat

## Context

The TV Lempire dashboard has a real-time chat system (Supabase broadcast). The goal is to mirror all messages bidirectionally with a Slack channel: site messages appear in Slack, Slack messages appear on the site.

User choices:
- **Deletions**: No sync (local to each platform)
- **Slack format**: Username override (messages appear as the site user, not as a generic bot)
- **Breaking news**: Sent to Slack with special formatting

## Architecture

```
Site user sends message:
  POST /api/messages → DB insert → Supabase broadcast → response
                     → fire-and-forget: Slack chat.postMessage (username override)

Slack user sends message:
  Slack Events API → POST /api/slack/events → verify signature
                   → skip if bot message (loop prevention)
                   → DB insert (source='slack') → Supabase broadcast to site clients
```

**Loop prevention**: Site→Slack posts come from our bot → Events API fires → we check `bot_id` / `event.user === BOT_USER_ID` → skip. No loop.

## Implementation

### 1. Database: Add columns to `messages` table

Run in Supabase SQL editor:

```sql
ALTER TABLE messages ADD COLUMN source TEXT NOT NULL DEFAULT 'site';
ALTER TABLE messages ADD COLUMN slack_user_name TEXT;

-- System user for Slack-originated messages (user_id is NOT NULL FK)
INSERT INTO users (id, email, name, password_hash, is_admin, verified)
VALUES ('00000000-0000-0000-0000-00000000beef', 'slack-bot@lempire.co', 'Slack', '$2a$10$placeholder', false, false);
```

No `slack_ts` column needed since we're not syncing deletions.

### 2. New file: `src/lib/slack.ts`

Three functions using raw `fetch` (consistent with existing Holistics integration pattern):

- **`postToSlack(userName, content, isBreakingNews)`** → `chat.postMessage` with `username` + `icon_url` override. If breaking news: prefix with `:rotating_light: *BREAKING NEWS*` and post normally too.
- **`getSlackUserName(slackUserId)`** → `users.info` API, returns `display_name || real_name || userId`
- **`verifySlackSignature(body, timestamp, signature)`** → HMAC-SHA256 verification using Web Crypto API

### 3. New file: `src/app/api/slack/events/route.ts`

Handles Slack Events API webhooks:

1. Replay protection (reject requests > 5min old)
2. Verify HMAC signature
3. Handle `url_verification` challenge (one-time Slack setup)
4. For `message` events in target channel:
   - Skip if `event.bot_id` or `event.user === SLACK_BOT_USER_ID` (loop prevention)
   - Skip if `event.subtype` (edits, joins, etc.)
   - Resolve Slack user name via `getSlackUserName()`
   - Insert to DB with `source: 'slack'`, `slack_user_name`, `user_id: SLACK_SYSTEM_USER_ID`
   - Broadcast via Supabase channel `"chat"` event `"new_message"`
5. Always return 200 (prevent Slack retries causing duplicates)

### 4. Modify: `src/app/api/messages/route.ts`

**GET handler** — add `source` and `slack_user_name` to select and response mapping:
- `.select("..., source, slack_user_name")`
- `userName: msg.source === "slack" ? msg.slack_user_name : users.name`

**POST handler** — after successful insert, fire-and-forget Slack post:
```
postToSlack(user.name, content, isBreakingNews).catch(console.error)
```
Breaking news IS sent to Slack (with special formatting).

### 5. Modify: `src/app/ChatOverlay.tsx`

Extend `Message` type with `source?: "site" | "slack"`. Pass `source` prop to `ChatMessage`.

### 6. Modify: `src/app/ChatMessage.tsx`

Add `source` prop. When `source === "slack"`, show a small "slack" badge before the username (styled in Slack brand pink `#e01e5a`).

### 7. Add CSS: `src/app/globals.css`

- `.chat-slack-badge` — small pill badge ("slack") in Slack pink
- `.chat-message-slack .chat-message-user` — username in Slack pink

### 8. Environment variables (Vercel + `.env.local`)

| Variable | Description |
|---|---|
| `SLACK_BOT_TOKEN` | Bot OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | From Slack app Basic Information |
| `SLACK_CHANNEL_ID` | Target channel ID (e.g. `C0123456789`) |
| `SLACK_BOT_USER_ID` | Bot's user ID (for loop prevention) |

`SLACK_SYSTEM_USER_ID` hardcoded as `00000000-0000-0000-0000-00000000beef`.

## Slack App Setup (manual, outside code)

1. Create app at api.slack.com/apps
2. Bot OAuth scopes: `chat:write`, `chat:write.customize`, `channels:history`, `users:read`
3. Event subscriptions: `message.channels` → URL: `https://<domain>/api/slack/events`
4. Install to workspace, invite bot to channel

## Files to create/modify

| File | Action |
|---|---|
| `src/lib/slack.ts` | **Create** — Slack API helpers |
| `src/app/api/slack/events/route.ts` | **Create** — Slack webhook endpoint |
| `src/app/api/messages/route.ts` | **Modify** — GET (new fields), POST (forward to Slack) |
| `src/app/ChatOverlay.tsx` | **Modify** — extend Message type, pass source prop |
| `src/app/ChatMessage.tsx` | **Modify** — add slack badge |
| `src/app/globals.css` | **Modify** — add slack badge CSS |

## Verification

1. Send a message on the site → check it appears in Slack (with the user's name)
2. Send a message in Slack → check it appears on the site (with "slack" badge)
3. Send a breaking news → check it appears in Slack with special formatting
4. Verify no loop: site→Slack message should NOT come back to site
5. Delete on site → Slack message stays (no sync, as requested)
6. Check Slack signature verification rejects unsigned requests
