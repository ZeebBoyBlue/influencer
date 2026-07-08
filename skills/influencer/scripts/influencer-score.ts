#!/usr/bin/env bun

import {
  parseCliInput,
  parseFollowerCount,
  printError,
  printJson,
  toBool,
} from "./lib/common.js";
import { extractThemes } from "./influencer-theme-extract.js";

export type InfluencerPlatform = "instagram" | "tiktok" | "twitter";

export interface InfluencerEngagementData {
  engagementRate?: number; // percentage
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  lastPostDaysAgo?: number;
  lastPostDate?: string;
  postsPerWeek?: number;
  isDormant?: boolean;
  isLowEngagement?: boolean;
  suspiciousFlags?: string[];
}

export interface InfluencerProfile {
  platform: InfluencerPlatform;
  username: string;
  displayName?: string;
  profileUrl?: string;
  bio?: string;
  bioLinks?: string[];
  followers?: number;
  followersDisplay?: string;
  isVerified?: boolean;
  contentThemes?: string[];
  engagement?: InfluencerEngagementData;
  lastPostDaysAgo?: number;
  isDormant?: boolean;
}

export interface InfluencerCriteria {
  query?: string;
  minFollowers?: number;
  maxFollowers?: number;
  verifiedOnly?: boolean;
  minEngagementRate?: number;
  excludeDormant?: boolean;
  maxDaysSinceLastPost?: number;
}

export interface ScoredProfile {
  profile: InfluencerProfile;
  score: number;
  matchesCriteria: boolean;
  reasons: string[];
}

export interface ScoreInput {
  profile?: InfluencerProfile;
  profiles?: InfluencerProfile[];
  criteria?: InfluencerCriteria;
}

function normalizeProfile(
  profile: InfluencerProfile,
  query: string,
): InfluencerProfile {
  const followers =
    profile.followers ??
    (profile.followersDisplay
      ? parseFollowerCount(profile.followersDisplay)
      : undefined);

  const bio = profile.bio ?? "";
  const themes = profile.contentThemes ?? extractThemes(bio, query);
  const bioLinks = profile.bioLinks ?? extractBioLinks(bio);

  // Merge engagement data from nested field or top-level
  const engagement = profile.engagement ?? {};
  const lastPostDaysAgo =
    profile.lastPostDaysAgo ?? engagement.lastPostDaysAgo;
  const isDormant =
    profile.isDormant ?? engagement.isDormant ??
    (lastPostDaysAgo !== undefined && lastPostDaysAgo >= 60);

  return {
    ...profile,
    followers,
    contentThemes: themes,
    bio,
    bioLinks,
    displayName: profile.displayName ?? profile.username,
    engagement: {
      ...engagement,
      lastPostDaysAgo,
      isDormant,
    },
    lastPostDaysAgo,
    isDormant,
  };
}

function extractBioLinks(bio: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const matches = bio.match(urlRegex) ?? [];
  // Also catch bare domain references like "linktr.ee/username"
  const linktreeRegex = /linktr\.ee\/[a-zA-Z0-9_]+/gi;
  const linktreeMatches = bio.match(linktreeRegex) ?? [];
  return [...new Set([...matches, ...linktreeMatches])];
}

export function matchesCriteria(
  profile: InfluencerProfile,
  criteria: InfluencerCriteria,
): boolean {
  if (criteria.verifiedOnly && !profile.isVerified) return false;

  if (criteria.minFollowers !== undefined && profile.followers !== undefined) {
    if (profile.followers < criteria.minFollowers) return false;
  }

  if (criteria.maxFollowers !== undefined && profile.followers !== undefined) {
    if (profile.followers > criteria.maxFollowers) return false;
  }

  const engRate = profile.engagement?.engagementRate;
  if (criteria.minEngagementRate !== undefined && engRate !== undefined) {
    if (engRate < criteria.minEngagementRate) return false;
  }

  if (criteria.excludeDormant && profile.isDormant) return false;

  if (
    criteria.maxDaysSinceLastPost !== undefined &&
    profile.lastPostDaysAgo !== undefined
  ) {
    if (profile.lastPostDaysAgo > criteria.maxDaysSinceLastPost) return false;
  }

  return true;
}

export function scoreProfile(
  profileInput: InfluencerProfile,
  criteria: InfluencerCriteria,
): ScoredProfile {
  const query = criteria.query ?? "";
  const profile = normalizeProfile(profileInput, query);

  const reasons: string[] = [];
  let score = 0;

  // --- Follower tiers ---
  if (profile.followers !== undefined) {
    if (profile.followers >= 1_000) score += 10;
    if (profile.followers >= 10_000) score += 15;
    if (profile.followers >= 100_000) score += 20;
    if (profile.followers >= 1_000_000) score += 15;
    reasons.push(`followers:${profile.followers}`);
  } else {
    reasons.push("followers:unknown");
  }

  // --- Verification ---
  if (profile.isVerified) {
    score += 10;
    reasons.push("verified");
  }

  // --- Query relevance (bio keyword matching) ---
  const bioLower = (profile.bio ?? "").toLowerCase();
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  let termHits = 0;
  for (const term of queryTerms) {
    if (bioLower.includes(term)) {
      termHits += 1;
      score += 8;
    }
  }
  if (termHits > 0) reasons.push(`query_hits:${termHits}`);

  // --- Content themes ---
  if ((profile.contentThemes?.length ?? 0) > 0) {
    score += Math.min(20, (profile.contentThemes?.length ?? 0) * 4);
    reasons.push(`themes:${(profile.contentThemes ?? []).join(",")}`);
  }

  // --- Engagement rate (new) ---
  const engRate = profile.engagement?.engagementRate;
  if (engRate !== undefined && profile.followers !== undefined) {
    // Engagement is the strongest quality signal
    // Micro-influencers (10k-100k) typically 3-8%, macro 1-3%, mega <1%
    if (engRate >= 5) score += 25;
    else if (engRate >= 3) score += 20;
    else if (engRate >= 1) score += 12;
    else if (engRate >= 0.5) score += 5;
    else score -= 10; // very low engagement penalizes
    reasons.push(`engagement:${engRate}%`);

    // Bonus: high engagement relative to follower tier
    if (profile.followers >= 100_000 && engRate >= 2) {
      score += 10;
      reasons.push("high_engagement_for_size");
    }
  } else {
    reasons.push("engagement:unknown");
  }

  // --- Posting recency (new) ---
  const daysAgo = profile.lastPostDaysAgo;
  if (daysAgo !== undefined) {
    if (daysAgo <= 3) score += 10;
    else if (daysAgo <= 7) score += 7;
    else if (daysAgo <= 14) score += 4;
    else if (daysAgo <= 30) score += 1;
    else if (daysAgo >= 60) {
      score -= 15;
      reasons.push("dormant");
    }
    if (daysAgo <= 7) reasons.push(`last_post:${daysAgo}d`);
  }

  // --- Posting frequency (new) ---
  const postsPerWeek = profile.engagement?.postsPerWeek;
  if (postsPerWeek !== undefined) {
    if (postsPerWeek >= 3) score += 5;
    else if (postsPerWeek >= 1) score += 3;
    reasons.push(`freq:${postsPerWeek}/wk`);
  }

  // --- Bio links (new) — bridge to contact info ---
  if ((profile.bioLinks?.length ?? 0) > 0) {
    score += Math.min(8, (profile.bioLinks?.length ?? 0) * 4);
    reasons.push(`bio_links:${profile.bioLinks?.length}`);
  }

  // --- Suspicious account flags (new) ---
  const flags = profile.engagement?.suspiciousFlags ?? [];
  if (flags.length > 0) {
    for (const flag of flags) {
      if (flag === "low_engagement_rate") score -= 20;
      if (flag === "dormant_60d") score -= 15;
      if (flag === "no_post_data") score -= 5;
    }
    reasons.push(`flags:${flags.join(",")}`);
  }

  // --- Criteria match ---
  const matches = matchesCriteria(profile, criteria);
  if (!matches) {
    reasons.push("criteria_mismatch");
    score -= 20;
  }

  return {
    profile,
    score,
    matchesCriteria: matches,
    reasons,
  };
}

export function scoreProfiles(
  profiles: InfluencerProfile[],
  criteria: InfluencerCriteria,
): ScoredProfile[] {
  return profiles
    .map((profile) => scoreProfile(profile, criteria))
    .sort((left, right) => right.score - left.score);
}

async function main(): Promise<void> {
  try {
    const { args, payload } = await parseCliInput<ScoreInput>(
      process.argv.slice(2),
      {},
    );

    const criteria: InfluencerCriteria = {
      ...(payload.criteria ?? {}),
      ...(typeof args.query === "string" ? { query: args.query } : {}),
      ...(typeof args["min-followers"] === "string"
        ? { minFollowers: Number.parseInt(args["min-followers"], 10) }
        : {}),
      ...(typeof args["max-followers"] === "string"
        ? { maxFollowers: Number.parseInt(args["max-followers"], 10) }
        : {}),
      ...(args["verified-only"] !== undefined
        ? {
            verifiedOnly:
              String(args["verified-only"]).toLowerCase() === "true",
          }
        : {}),
      ...(typeof args["min-engagement"] === "string"
        ? { minEngagementRate: Number.parseFloat(args["min-engagement"]) }
        : {}),
      ...(args["exclude-dormant"] !== undefined
        ? { excludeDormant: toBool(args["exclude-dormant"]) }
        : {}),
      ...(typeof args["max-days-since-post"] === "string"
        ? { maxDaysSinceLastPost: Number.parseInt(args["max-days-since-post"], 10) }
        : {}),
    };

    const profiles =
      payload.profiles ?? (payload.profile ? [payload.profile] : []);
    const scored = scoreProfiles(profiles, criteria);

    printJson({ ok: true, data: scored });
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  await main();
}
