# Influencer Marketing

Research influencers across Instagram, TikTok, and X/Twitter through your assistant's browser. Plan your campaign strategy, find, vet, and shortlist the right creators, then track them in an interactive dashboard.

## What it does

**Three skills:**

1. **Influencer Strategy Builder** — Walks you through building an influencer marketing campaign from scratch: goals, target audience, platform selection, influencer tiers, budget allocation. Produces a concrete campaign brief, then hands off to the research skill with the right search criteria.

2. **Influencer Research** — Browser-automated influencer discovery, enrichment, scoring, and export:
   - **Discover** candidates by platform — search Instagram posts, TikTok user search, or X/Twitter people search
   - **Enrich** profiles — pull bios, follower counts, verification status, content themes, **engagement rates**, **posting recency**, **bio links**
   - **Score** candidates against your campaign criteria (follower ranges, engagement rate minimums, verified-only, exclude dormant, query relevance)
   - **Compare** a shortlist — ranked output grouped by platform with full enrichment data
   - **Export** to CSV or JSON — ready to share with a team or import into a CRM

3. **Influencer Dashboard** — Turns a shortlist export into a persistent interactive app: summary stats, sortable/filterable table, engagement-vs-score chart, per-influencer detail with outreach links, and an editable outreach status tracker (not contacted → signed).

All browser operations run through the `assistant browser` CLI. Helper scripts handle deterministic parsing, scoring, engagement math, and comparison via `bun`.

## Install

From the Vellum plugin marketplace:

```bash
assistant plugins install influencer-marketing
```

Then just ask your assistant — e.g. "I want to run an influencer campaign for my fitness app" (routes to strategy), or "find fitness creators on Instagram with 10k-100k followers" (routes directly to research).

## Requirements

- Vellum desktop assistant (macOS)
- `bun` installed on the host machine
- Browser automation enabled (`assistant browser` CLI)
- **Recommended:** the [Vellum Assistant Chrome extension](https://chromewebstore.google.com/detail/vellum-assistant/hphbdmpffeigpcdjkckleobjmhhokpne) — extension mode drives your real signed-in Chrome, which is what gets past Instagram/TikTok/X sign-in walls. The research skill walks you through setup on first run.

## How it works

### Strategy Builder workflow

1. **Gather context** — conversational Q&A about your product, goal, audience, budget
2. **Build the brief** — structured campaign brief with influencer tier recommendations, content approach, outreach approach, success metrics
3. **Define research criteria** — translates the brief into concrete search parameters (platforms, keywords, follower ranges, engagement minimums)
4. **Hand off to research** — executes the discovery and enrichment workflow with strategy-aligned criteria

### Research workflow

1. **Route intent** — classifies whether you want discovery, enrichment, comparison, or export
2. **Discover** — navigates platform search surfaces, extracts candidates
3. **Enrich** — visits profile pages, extracts metadata + recent post data, computes engagement rates, checks posting recency, pulls bio links
4. **Compare** — builds a ranked shortlist grouped by platform, with full enrichment data
5. **Export** — generates CSV or JSON file for team sharing

Helper scripts (`scripts/`) are deterministic TypeScript — no LLM calls, just parsing, scoring, and math. Browser navigation and extraction are handled by the assistant through `assistant browser` CLI commands.

## Scoring model

The scoring weights multiple signals:

| Signal | Weight | Notes |
|--------|--------|-------|
| Follower count tiers | Up to +60 | 1K→10K→100K→1M tiers |
| Engagement rate | Up to +35 | Strongest quality signal. ≥5% = +25, ≥3% = +20, ≥1% = +12 |
| High engagement for size | +10 | Bonus for 100K+ followers with ≥2% engagement |
| Posting recency | +10 to -15 | Active accounts rewarded, dormant (60d+) penalized |
| Posting frequency | Up to +5 | 3+ posts/week = +5 |
| Bio keyword relevance | +8/hit | Query terms found in bio |
| Content themes | Up to +20 | Matching content categories |
| Verification | +10 | Verified badge bonus |
| Bio links | Up to +8 | Links in bio (bridge to contact info) |
| Suspicious flags | -5 to -20 | Low engagement on large accounts, dormant, no post data |
| Criteria mismatch | -20 | Fails follower/engagement/verified/recency filters |

## License

MIT
