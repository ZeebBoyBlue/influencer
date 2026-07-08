import { describe, expect, test } from "bun:test";

import { scoreProfile } from "../influencer-score.js";

describe("scoreProfile", () => {
  test("scores verified profile with strong follower count higher", () => {
    const scored = scoreProfile(
      {
        platform: "instagram",
        username: "coachmax",
        bio: "Fitness and wellness creator",
        followersDisplay: "250K",
        isVerified: true,
      },
      {
        query: "fitness wellness",
        minFollowers: 10_000,
      },
    );

    expect(scored.matchesCriteria).toBe(true);
    expect(scored.score).toBeGreaterThan(30);
    expect(scored.reasons).toContain("verified");
  });

  test("marks mismatch when profile violates verified-only criteria", () => {
    const scored = scoreProfile(
      {
        platform: "tiktok",
        username: "microcreator",
        followersDisplay: "12K",
        isVerified: false,
      },
      {
        verifiedOnly: true,
      },
    );

    expect(scored.matchesCriteria).toBe(false);
    expect(scored.reasons).toContain("criteria_mismatch");
  });

  test("high engagement rate boosts score significantly", () => {
    const withEngagement = scoreProfile(
      {
        platform: "instagram",
        username: "microstar",
        bio: "fitness coach",
        followers: 150_000,
        engagement: { engagementRate: 6.5, lastPostDaysAgo: 2, postsPerWeek: 4 },
      },
      { query: "fitness", minFollowers: 10_000 },
    );

    const withoutEngagement = scoreProfile(
      {
        platform: "instagram",
        username: "microstar2",
        bio: "fitness coach",
        followers: 150_000,
      },
      { query: "fitness", minFollowers: 10_000 },
    );

    expect(withEngagement.score).toBeGreaterThan(withoutEngagement.score);
    expect(withEngagement.reasons).toContain("engagement:6.5%");
    expect(withEngagement.reasons).toContain("high_engagement_for_size");
  });

  test("low engagement on large account is penalized", () => {
    const scored = scoreProfile(
      {
        platform: "tiktok",
        username: "deadaccount",
        followers: 300_000,
        engagement: {
          engagementRate: 0.2,
          suspiciousFlags: ["low_engagement_rate"],
        },
      },
      { query: "" },
    );

    expect(scored.score).toBeLessThan(50); // penalized, not just neutral
    expect(scored.reasons).toContain("flags:low_engagement_rate");
  });

  test("dormant accounts are penalized", () => {
    const scored = scoreProfile(
      {
        platform: "instagram",
        username: "ghost",
        followers: 20_000,
        engagement: {
          engagementRate: 2.5,
          lastPostDaysAgo: 75,
          isDormant: true,
          suspiciousFlags: ["dormant_60d"],
        },
      },
      { query: "" },
    );

    expect(scored.reasons).toContain("dormant");
    expect(scored.reasons).toContain("flags:dormant_60d");
  });

  test("bio links are extracted and boost score", () => {
    const scored = scoreProfile(
      {
        platform: "instagram",
        username: "linkedcreator",
        bio: "Fitness coach | Online programs at linktr.ee/coach",
        followers: 15_000,
      },
      { query: "fitness" },
    );

    expect(scored.profile.bioLinks).toBeDefined();
    expect(scored.profile.bioLinks!.length).toBeGreaterThan(0);
    expect(scored.reasons).toContain("bio_links:1");
  });

  test("excludeDormant criteria filters dormant profiles", () => {
    const scored = scoreProfile(
      {
        platform: "tiktok",
        username: "inactive",
        followers: 10_000,
        lastPostDaysAgo: 90,
        isDormant: true,
      },
      { excludeDormant: true, minFollowers: 1_000 },
    );

    expect(scored.matchesCriteria).toBe(false);
  });

  test("minEngagementRate criteria filters low engagement", () => {
    const scored = scoreProfile(
      {
        platform: "instagram",
        username: "loweng",
        followers: 40_000,
        engagement: { engagementRate: 0.8 },
      },
      { minEngagementRate: 2.0 },
    );

    expect(scored.matchesCriteria).toBe(false);
  });

  test("maxDaysSinceLastPost criteria filters stale accounts", () => {
    const scored = scoreProfile(
      {
        platform: "twitter",
        username: "staleposter",
        followers: 25_000,
        lastPostDaysAgo: 45,
      },
      { maxDaysSinceLastPost: 30 },
    );

    expect(scored.matchesCriteria).toBe(false);
  });
});
