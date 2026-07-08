#!/usr/bin/env bun

import {
  parseCliInput,
  parseFollowerCount,
  printError,
  printJson,
} from "./lib/common.js";

/**
 * Engagement rate calculator.
 *
 * Takes raw post data extracted from a profile (via `assistant browser`
 * snapshot/extract) and computes:
 *   - Average likes, comments, views per post
 *   - Engagement rate = avg(likes + comments) / followers
 *   - Posting recency (days since last post)
 *   - Posting frequency (posts per week)
 *
 * The assistant extracts post-level metrics from the profile page DOM
 * and passes them here as structured JSON. This script does the math.
 */

export interface PostMetrics {
  likes?: number;
  likesDisplay?: string;
  comments?: number;
  commentsDisplay?: string;
  views?: number;
  viewsDisplay?: string;
  postedAt?: string; // ISO date or relative ("2d ago", "3w ago")
  caption?: string;
}

export interface EngagementInput {
  platform?: string;
  followers?: number;
  followersDisplay?: string;
  posts?: PostMetrics[];
}

export interface EngagementResult {
  followerCount: number | undefined;
  postCount: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number | undefined;
  avgEngagementPerPost: number;
  engagementRate: number; // percentage, e.g. 3.5 = 3.5%
  engagementRateLabel: string;
  lastPostDaysAgo: number | undefined;
  lastPostDate: string | undefined;
  postsPerWeek: number | undefined;
  isDormant: boolean; // no posts in 60+ days
  isLowEngagement: boolean; // < 0.5% on 50k+ followers
  suspiciousFlags: string[];
  ratedPosts: PostMetrics[];
}

function resolveCount(
  num?: number,
  display?: string,
): number | undefined {
  if (num !== undefined) return num;
  if (display) return parseFollowerCount(display);
  return undefined;
}

/**
 * Parse a relative date string ("2d ago", "3w ago", "1mo ago")
 * or ISO date into days ago.
 */
export function parseDateToDaysAgo(input?: string): number | undefined {
  if (!input) return undefined;

  // Try ISO date first
  const isoDate = new Date(input);
  if (!Number.isNaN(isoDate.getTime())) {
    const diffMs = Date.now() - isoDate.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  // Relative: "2d ago", "3w ago", "1mo ago", "5h ago"
  const relMatch = input
    .toLowerCase()
    .match(/(\d+)\s*(h|d|w|mo|y)\s*ago/);
  if (!relMatch) return undefined;

  const value = Number.parseInt(relMatch[1], 10);
  const unit = relMatch[2];

  switch (unit) {
    case "h": return Math.round(value / 24) || 0;
    case "d": return value;
    case "w": return value * 7;
    case "mo": return value * 30;
    case "y": return value * 365;
    default: return undefined;
  }
}

export function computeEngagement(input: EngagementInput): EngagementResult {
  const followers = resolveCount(input.followers, input.followersDisplay);
  const posts = input.posts ?? [];

  const ratedPosts = posts.map((post) => ({
    ...post,
    likes: resolveCount(post.likes, post.likesDisplay) ?? 0,
    comments: resolveCount(post.comments, post.commentsDisplay) ?? 0,
    views: resolveCount(post.views, post.viewsDisplay),
  }));

  const postCount = ratedPosts.length;
  const avgLikes = postCount > 0
    ? Math.round(ratedPosts.reduce((sum, p) => sum + (p.likes ?? 0), 0) / postCount)
    : 0;
  const avgComments = postCount > 0
    ? Math.round(ratedPosts.reduce((sum, p) => sum + (p.comments ?? 0), 0) / postCount)
    : 0;

  const postsWithViews = ratedPosts.filter((p) => p.views !== undefined);
  const avgViews = postsWithViews.length > 0
    ? Math.round(postsWithViews.reduce((sum, p) => sum + (p.views ?? 0), 0) / postsWithViews.length)
    : undefined;

  const avgEngagementPerPost = avgLikes + avgComments;

  let engagementRate = 0;
  if (followers && followers > 0) {
    engagementRate = (avgEngagementPerPost / followers) * 100;
  }

  // Posting recency
  const daysAgoList = ratedPosts
    .map((p) => parseDateToDaysAgo(p.postedAt))
    .filter((d): d is number => d !== undefined)
    .sort((a, b) => a - b);

  const lastPostDaysAgo = daysAgoList.length > 0 ? daysAgoList[0] : undefined;
  const lastPostDate = lastPostDaysAgo !== undefined
    ? new Date(Date.now() - lastPostDaysAgo * 86400000).toISOString().split("T")[0]
    : undefined;

  // Posting frequency: posts per week
  let postsPerWeek: number | undefined;
  if (daysAgoList.length >= 2) {
    const oldestDay = daysAgoList[daysAgoList.length - 1];
    const spanDays = Math.max(1, oldestDay - daysAgoList[0]);
    postsPerWeek = Math.round((postCount / spanDays) * 7 * 10) / 10;
  }

  // Flags
  const suspiciousFlags: string[] = [];
  const isDormant = lastPostDaysAgo !== undefined && lastPostDaysAgo >= 60;
  if (isDormant) suspiciousFlags.push("dormant_60d");

  const isLowEngagement =
    followers !== undefined &&
    followers >= 50_000 &&
    engagementRate < 0.5;
  if (isLowEngagement) suspiciousFlags.push("low_engagement_rate");

  if (postCount === 0) suspiciousFlags.push("no_post_data");

  const engagementRateLabel = followers
    ? `${engagementRate.toFixed(2)}%`
    : "unknown (no follower data)";

  return {
    followerCount: followers,
    postCount,
    avgLikes,
    avgComments,
    avgViews,
    avgEngagementPerPost,
    engagementRate: Math.round(engagementRate * 100) / 100,
    engagementRateLabel,
    lastPostDaysAgo,
    lastPostDate,
    postsPerWeek,
    isDormant,
    isLowEngagement,
    suspiciousFlags,
    ratedPosts,
  };
}

async function main(): Promise<void> {
  try {
    const { args, payload } = await parseCliInput<EngagementInput>(
      process.argv.slice(2),
      {},
    );

    const followers =
      (typeof args.followers === "string"
        ? Number.parseInt(args.followers, 10)
        : undefined) ?? payload.followers;

    const followersDisplay =
      (typeof args["followers-display"] === "string"
        ? args["followers-display"]
        : undefined) ?? payload.followersDisplay;

    const data = computeEngagement({
      ...payload,
      followers,
      followersDisplay,
    });

    printJson({ ok: true, data });
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  await main();
}
