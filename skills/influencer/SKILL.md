---
name: influencer
description: >-
  Find and research influencers on Instagram, TikTok, and X/Twitter. Discovers
  real profiles, computes engagement rates, scores candidates, and exports a
  ranked shortlist. Use when the user asks to find influencers, research
  creators, or build a shortlist for a brand or product.
metadata:
  emoji: "🔍"
  vellum:
    category: "browsing"
    display-name: "Influencer Research"
    activation-hints:
      - "Find influencers for my brand"
      - "Find influencers for my product"
      - "Research creators or influencers for a campaign"
      - "Build a shortlist of influencers"
      - "Find people with a following on a specific topic"
      - "I need influencer recommendations"
      - "Search for creators on Instagram, TikTok, or X/Twitter"
    avoid-when:
      - "User wants to plan an influencer campaign strategy from scratch (use influencer-strategy skill)"
---

## CRITICAL — Read before doing anything

- **Do NOT use `web_search`, `web_fetch`, or any web tool to find influencers.** This is a hard constraint. The entire point of this skill is deterministic discovery, engagement calculation, scoring, and export via the scripts in `scripts/`. Web search produces none of this. If you are about to use `web_search` to "find influencers," stop — you are in the wrong workflow.
- **All research is done through browser automation** (`assistant browser` CLI via `host_bash`) + the scoring scripts in this skill's `scripts/` directory (run via `bash`). No exceptions.
- **If this skill was loaded by the `influencer-strategy` skill's handoff**, use the criteria from the strategy brief as scoring flags — do not re-derive them from scratch.

Two tool channels:
- **`host_bash`** — for `assistant browser` CLI commands (navigate, snapshot, extract, scroll). These control the user's browser and must run on the host.
- **`bash`** — for scoring scripts in `scripts/`. These parse JSON and compute metrics; they run in the sandbox where `bun` is available.

## Hard constraints

- **Do NOT substitute `web_search`, `web_fetch`, or manual research for this skill's workflow.** The entire point of this plugin is deterministic discovery, engagement calculation, scoring, and export via the scripts in `scripts/`. Web search produces none of this. If you are about to use `web_search` to "find influencers," stop — you are in the wrong skill.
- Do not call `assistant browser chrome relay`.
- Do not use legacy relay-backed influencer scripts.
- If this skill was loaded by the `influencer-strategy` skill's handoff, use the criteria from the strategy brief as the scoring flags — do not re-derive them from scratch.

## Step graph (state machine)

### Step 0: Browser setup (run once per session)

Verify a browser backend is ready before any discovery:

```bash
assistant browser status
```

(run via `host_bash` — the browser lives on the user's machine)

**Preferred backend: `extension`.** Instagram, TikTok, and X/Twitter aggressively wall off logged-out and automated browsers. Extension mode drives the user's real, signed-in Chrome — it inherits their sessions and passes as normal browsing. Local Playwright works as a fallback but hits sign-in walls and challenges far more often.

If `status` shows `✗ extension` ("no Chrome Extension is connected"), walk the user through setup:

1. Ask them to install the **Vellum Assistant** Chrome extension:
   https://chromewebstore.google.com/detail/vellum-assistant/hphbdmpffeigpcdjkckleobjmhhokpne
2. After installing, have them click the Vellum Assistant icon in Chrome's toolbar (pin it from the puzzle-piece menu if hidden) and confirm it shows as connected to their assistant.
3. Re-run `assistant browser status` until `extension` shows `✓`. The status output includes remediation steps — follow those over anything written here if they differ.
4. Have the user sign in to the target platform(s) (Instagram / TikTok / X) in that Chrome profile if they aren't already. Their sessions are what make discovery work.

If the user declines the extension, proceed with the recommended backend from `status`, but warn that sign-in walls are likely and the retry/fallback policy below will kick in more often.

### Step 1: Route intent

Use deterministic routing when intent is unclear:

```bash
bun scripts/influencer-intent.ts --request "<latest user request>" --has-candidates <true|false> --has-shortlist <true|false>
```

Use returned `step` to route to `discover`, `enrich_profile`, or `compare_shortlist`.

### Step 2: Discover candidates (`discover`)

#### Instagram

1. Navigate to keyword search/post surfaces.
2. Snapshot + extract:

```bash
assistant browser --session influencer --json snapshot
assistant browser --session influencer --json extract --include-links
```

3. Parse candidates:

```bash
bun scripts/influencer-parse-candidates.ts --platform instagram --input-json '<json payload with extracted text/links>'
```

#### TikTok

1. Navigate to user search page for query.
2. Use `assistant browser --session influencer scroll` + `assistant browser --session influencer wait-for` to load additional candidates.
3. Extract and parse:

```bash
bun scripts/influencer-parse-candidates.ts --platform tiktok --input-json '<json payload with extracted text>'
```

#### X/Twitter

1. Navigate to people search view (`f=user`).
2. Snapshot + extract:

```bash
assistant browser --session influencer --json snapshot
assistant browser --session influencer --json extract --include-links
```

3. Parse:

```bash
bun scripts/influencer-parse-candidates.ts --platform twitter --input-json '<json payload with extracted text/links>'
```

### Step 3: Enrich profiles (`enrich_profile`)

For each selected candidate profile:

1. Navigate to profile URL.
2. Snapshot + extract profile metadata (bio, follower counts, verification indicators, bio links).
3. Extract recent post data — navigate to the first 3-5 posts and extract likes, comments, views, and post dates.
4. Compute engagement metrics:

```bash
bun scripts/influencer-engagement.ts --followers <n> --input-json '<json payload with post metrics array>'
```

5. Merge engagement results into profile objects, then score with criteria:

```bash
bun scripts/influencer-score.ts --query "<user query>" --min-followers <n> --max-followers <n> --verified-only <true|false> --min-engagement <rate> --exclude-dormant <true|false> --max-days-since-post <n> --input-json '<json payload with profiles including engagement data>'
```

6. If themes are missing, enrich using:

```bash
bun scripts/influencer-theme-extract.ts --bio "<bio>" --query "<user query>"
```

**Engagement data extraction notes:**
- Instagram: likes are visible on posts, comments count is visible. Extract both.
- TikTok: likes, comments, and views are all visible on the profile grid.
- X/Twitter: reply count, retweet count, and like count are visible on posts. Use likes + replies as engagement.
- Bio links: extract any URLs in the bio (Linktree, personal site, business page). These are the bridge to contact info for outreach.

### Step 4: Build shortlist (`compare_shortlist`)

Generate deterministic comparison output:

```bash
bun scripts/influencer-compare.ts --limit <n> --input-json '<json payload with profiles and criteria>'
```

Present results grouped by platform with:

- Username / display name
- Followers (normalized)
- Verification status
- Engagement rate
- Last post date / recency
- Posting frequency
- Bio links (for outreach)
- Content themes
- Suspicious flags (dormant, low engagement)
- Score breakdown (highlights)
- Profile URL

### Step 5: Export shortlist (`export`)

Export the final shortlist to CSV or JSON for team sharing:

```bash
bun scripts/influencer-export.ts --format csv --input-json '<json payload with compared influencers>' > shortlist.csv
bun scripts/influencer-export.ts --format json --input-json '<json payload with compared influencers>' > shortlist.json
```

The CSV includes all enrichment fields (platform, username, followers, verified, score, engagement rate, last post, posts/week, themes, bio links, flags, profile URL) — ready to share with a team or import into a CRM.

After export, offer to build an interactive dashboard from the shortlist — load the `influencer-dashboard` skill and pass it the JSON export.

## Retry and fallback policy

- Retry budget: 3 attempts for each state-changing browser step.
- After any navigation or click that changes DOM, run fresh `assistant browser --session influencer --json snapshot`.
- If blocked by sign-in wall or challenge after retries, ask user to complete that step and resume from latest successful state.

## Platform notes

- Instagram search often surfaces posts/reels before profiles; use author-handle pivot logic.
- TikTok search can require scroll cycles to load profile cards.
- X/Twitter should use people-search surfaces to avoid irrelevant mixed-content feeds.

## Example helper payload shape

```json
{
  "phase": "discover",
  "context": { "platform": "instagram" },
  "extracted": {
    "text": "...",
    "links": ["https://www.instagram.com/example/"]
  },
  "userIntent": "find fitness creators"
}
```
