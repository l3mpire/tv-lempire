# NewsTicker Content Ideas

Currently the ticker only displays chat messages (with breaking news support). Here are ideas to enrich it with more company/product information.

## Business Data (already available in the app)

- **ARR milestones**: "lemlist just crossed $XX M ARR!" when a round threshold is hit
- **Daily growth**: "$X,XXX earned today" or "Growing at $X/sec"
- **Month comparison**: "This month: +$XXK so far" per product

## Product / Company Info

- **Customer count**: "lemlist: XX,000+ users worldwide"
- **Recent features**: "New: AI sequence writer launched on lemlist"
- **Product updates**: changelog highlights, new integrations
- **Uptime / performance**: "99.9% uptime this month"

## Social / Team

- **Team milestones**: "Welcome [new hire]!", "Happy anniversary [name]!"
- **Customer wins**: "Customer X closed $XXK deal using lemlist"
- **Reviews / NPS**: "New G2 review: 5 stars" or live NPS score
- **Social media**: latest tweets/posts mentioning products, follower count

## Market Data

- **Industry news**: SaaS trends, sales tech
- **Competitor updates**: funding rounds, acquisitions in the sector

## Fun / Culture

- **Inspirational quotes**: quotes about entrepreneurship, sales
- **Fun facts**: "X emails sent via lemlist today", "X meetings booked via Claap"
- **Team polls**: internal poll results

## Implementation Options

1. **Pluggable "sources" system** — each source (chat, milestones, product facts, social...) produces items with a type/priority, the ticker mixes them automatically
2. **Automatic mix** — the ticker blends items from different sources for variety
3. **Simple approach** — a Supabase `ticker_items` table where the admin can manually add items (text + category + expiration), and the ticker interleaves them with chat messages
