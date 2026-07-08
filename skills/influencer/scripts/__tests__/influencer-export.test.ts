import { describe, expect, test } from "bun:test";

import { exportToCsv, exportToJson, exportInfluencers } from "../influencer-export.js";

describe("exportToCsv", () => {
  test("generates CSV with header and rows", () => {
    const csv = exportToCsv([
      {
        platform: "instagram",
        username: "coachmax",
        displayName: "Coach Max",
        followers: 250_000,
        verified: true,
        score: 85,
        engagementRateLabel: "3.5%",
        contentThemes: ["fitness", "wellness"],
        bioLinks: ["https://linktr.ee/coachmax"],
        profileUrl: "https://www.instagram.com/coachmax/",
      },
      {
        platform: "tiktok",
        username: "fitguru",
        displayName: "Fit Guru",
        followers: 45_000,
        verified: false,
        score: 62,
        engagementRateLabel: "5.2%",
        contentThemes: ["fitness"],
        profileUrl: "https://www.tiktok.com/@fitguru",
      },
    ]);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("Platform");
    expect(lines[0]).toContain("Username");
    expect(lines[0]).toContain("Engagement Rate");
    expect(lines.length).toBe(3); // header + 2 rows
    expect(lines[1]).toContain("coachmax");
    expect(lines[1]).toContain("Yes");
    expect(lines[1]).toContain("3.5%");
    expect(lines[2]).toContain("fitguru");
    expect(lines[2]).toContain("No");
  });

  test("escapes commas in fields", () => {
    const csv = exportToCsv([
      {
        platform: "instagram",
        username: "test",
        displayName: "Name, With Comma",
        contentThemes: ["fitness, wellness"],
      },
    ]);

    expect(csv).toContain('"Name, With Comma"');
    expect(csv).toContain('"fitness, wellness"');
  });

  test("handles empty input", () => {
    const csv = exportToCsv([]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1); // header only
  });
});

describe("exportToJson", () => {
  test("generates valid JSON array", () => {
    const json = exportToJson([
      { platform: "instagram", username: "test", score: 50 },
    ]);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].username).toBe("test");
  });
});

describe("exportInfluencers", () => {
  test("defaults to CSV format", () => {
    const result = exportInfluencers({
      influencers: [{ username: "test" }],
    });
    expect(result).toContain("Platform");
    expect(result).toContain("test");
  });

  test("respects json format", () => {
    const result = exportInfluencers({
      format: "json",
      influencers: [{ username: "test" }],
    });
    const parsed = JSON.parse(result);
    expect(parsed[0].username).toBe("test");
  });
});
