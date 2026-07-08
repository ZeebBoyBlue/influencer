---
name: influencer-dashboard
description: >-
  Build an interactive dashboard from an influencer research shortlist. Use
  when the user wants to visualize, browse, or track the influencers found by
  the influencer research skill — a dashboard, tracker, or overview of their
  creator shortlist.
metadata:
  emoji: "📊"
  vellum:
    category: "marketing"
    display-name: "Influencer Dashboard"
    activation-hints:
      - "Build a dashboard for the influencers we found"
      - "Visualize my influencer shortlist"
      - "Make a tracker for my creator outreach"
      - "Show me an overview of the influencer research results"
    avoid-when:
      - "User wants to find or research new influencers (use the influencer skill)"
      - "User wants to plan campaign strategy (use the influencer-strategy skill)"
---

Build a persistent, interactive dashboard app from an influencer shortlist produced by the `influencer` skill.

## Prerequisites

1. **Load the `app-builder` skill first** (`skill_load` with `skill: "app-builder"`). The dashboard is a persistent app, not a one-off page — it must survive the conversation so the user can return to it. Follow app-builder's workflow for scaffolding, building, and opening the app.
2. **Get the shortlist data.** In priority order:
   - A `shortlist.json` export from the `influencer` skill (this conversation or a saved file in the workspace).
   - A `shortlist.csv` export — parse it back to objects.
   - Shortlist data still in conversation context from a just-finished research run.
   - If none exist, do not fabricate data. Offer to run the `influencer` skill first.

## Input data shape

Each influencer record from the export pipeline has these fields (all may be present; treat missing ones as unknown, not zero):

```json
{
  "platform": "instagram | tiktok | twitter",
  "username": "handle",
  "followers": 10000,
  "verified": true,
  "score": 82,
  "engagementRate": 0.034,
  "lastPostDate": "2026-07-01",
  "postsPerWeek": 3,
  "themes": ["leather goods"],
  "bioLinks": ["https://linktr.ee/handle"],
  "flags": ["dormant"],
  "profileUrl": "https://instagram.com/handle"
}
```

Note: `engagementRate` is a decimal fraction (0.034 = 3.4%). Render as a percentage.

## Dashboard spec

Build these sections, in this order:

1. **Summary bar** — total influencers, count per platform, average score, average engagement rate, count flagged.
2. **Shortlist table** — the core. One row per influencer: username (linked to `profileUrl`), platform badge, followers (abbreviated: 12.4K), engagement rate (%), score, last post date, posts/week, flags as warning badges. Sortable by score, followers, and engagement. Filterable by platform and by flag status (hide flagged).
3. **Score vs. engagement scatter or ranked bar chart** — makes outliers obvious: high engagement at low follower count is the deal-hunting zone for mid-premium brands.
4. **Detail panel** — clicking a row shows full record: themes, all bio links (these are the outreach bridge — make them prominent and clickable), score breakdown if present.
5. **Outreach tracker** — a status column the user can edit per influencer: `not contacted / contacted / replied / negotiating / signed / passed`. Persist status in the app's local storage so it survives reloads. This turns the dashboard from a report into a working tool.

## Rules

- Bake the shortlist data into the app at build time (embedded JSON), plus an "import JSON" affordance so the user can paste a newer export without a rebuild.
- Do not call external APIs from the app. All data is local.
- Keep the visual style clean and dense — this is an operator tool, not a landing page. Dark-friendly, no decorative fluff.
- After building, open the app for the user and give a one-line summary of what's in it (counts, top pick by score).

## Handoffs

- User wants to add more influencers → route to the `influencer` skill, then re-import the new export here.
- User asks strategy questions (budget, tiers, outreach copy) → route to the `influencer-strategy` skill.
