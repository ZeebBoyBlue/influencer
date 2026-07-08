import { describe, expect, test } from "bun:test";

import { computeEngagement, parseDateToDaysAgo } from "../influencer-engagement.js";

describe("computeEngagement", () => {
  test("computes engagement rate from post likes and comments", () => {
    const result = computeEngagement({
      followers: 50_000,
      posts: [
        { likes: 2000, comments: 150 },
        { likes: 1800, comments: 120 },
        { likes: 2200, comments: 180 },
      ],
    });

    expect(result.postCount).toBe(3);
    expect(result.avgLikes).toBe(2000);
    expect(result.avgComments).toBe(150);
    expect(result.avgEngagementPerPost).toBe(2150);
    // 2150 / 50000 * 100 = 4.3%
    expect(result.engagementRate).toBe(4.3);
    expect(result.engagementRateLabel).toBe("4.30%");
  });

  test("handles display format follower counts", () => {
    const result = computeEngagement({
      followersDisplay: "100K",
      posts: [
        { likesDisplay: "5K", commentsDisplay: "300" },
      ],
    });

    expect(result.followerCount).toBe(100_000);
    expect(result.avgLikes).toBe(5000);
    expect(result.avgComments).toBe(300);
    // 5300 / 100000 * 100 = 5.3%
    expect(result.engagementRate).toBe(5.3);
  });

  test("flags low engagement on large accounts", () => {
    const result = computeEngagement({
      followers: 200_000,
      posts: [
        { likes: 100, comments: 5 },
        { likes: 80, comments: 3 },
      ],
    });

    // 94 / 200000 * 100 = 0.047%
    expect(result.isLowEngagement).toBe(true);
    expect(result.suspiciousFlags).toContain("low_engagement_rate");
  });

  test("flags dormant accounts with old posts", () => {
    const result = computeEngagement({
      followers: 30_000,
      posts: [
        { likes: 500, comments: 30, postedAt: "65d ago" },
        { likes: 600, comments: 40, postedAt: "80d ago" },
      ],
    });

    expect(result.isDormant).toBe(true);
    expect(result.suspiciousFlags).toContain("dormant_60d");
    expect(result.lastPostDaysAgo).toBe(65);
  });

  test("does not flag small accounts for low engagement", () => {
    const result = computeEngagement({
      followers: 5_000,
      posts: [
        { likes: 10, comments: 1 },
      ],
    });

    // 11 / 5000 * 100 = 0.22% — low but account is small, not suspicious
    expect(result.isLowEngagement).toBe(false);
  });

  test("computes posting frequency from date range", () => {
    const result = computeEngagement({
      followers: 20_000,
      posts: [
        { likes: 1000, comments: 50, postedAt: "2d ago" },
        { likes: 900, comments: 40, postedAt: "5d ago" },
        { likes: 1100, comments: 60, postedAt: "9d ago" },
        { likes: 950, comments: 45, postedAt: "12d ago" },
      ],
    });

    expect(result.postsPerWeek).toBeDefined();
    expect(result.postsPerWeek!).toBeGreaterThan(0);
  });

  test("handles empty posts array", () => {
    const result = computeEngagement({
      followers: 10_000,
      posts: [],
    });

    expect(result.postCount).toBe(0);
    expect(result.avgLikes).toBe(0);
    expect(result.suspiciousFlags).toContain("no_post_data");
  });

  test("extracts views when available (TikTok)", () => {
    const result = computeEngagement({
      followers: 80_000,
      posts: [
        { likes: 3000, comments: 200, views: 150_000 },
        { likes: 2500, comments: 150, views: 120_000 },
      ],
    });

    expect(result.avgViews).toBe(135_000);
  });
});

describe("parseDateToDaysAgo", () => {
  test("parses relative date strings", () => {
    expect(parseDateToDaysAgo("2d ago")).toBe(2);
    expect(parseDateToDaysAgo("3w ago")).toBe(21);
    expect(parseDateToDaysAgo("1mo ago")).toBe(30);
    expect(parseDateToDaysAgo("5h ago")).toBe(0);
  });

  test("returns undefined for unparseable input", () => {
    expect(parseDateToDaysAgo(undefined)).toBeUndefined();
    expect(parseDateToDaysAgo("recently")).toBeUndefined();
  });
});
