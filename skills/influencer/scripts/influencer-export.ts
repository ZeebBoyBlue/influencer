#!/usr/bin/env bun

import { parseCliInput, printError, printJson } from "./lib/common.js";

/**
 * Export a shortlist of influencers to CSV or JSON.
 *
 * Input: array of compared influencer objects (output from influencer-compare.ts)
 * Output: formatted string (CSV or JSON) ready to write to a file.
 *
 * Usage:
 *   bun influencer-export.ts --format csv --input-json '...' > shortlist.csv
 *   bun influencer-export.ts --format json --input-json '...' > shortlist.json
 */

export type ExportFormat = "csv" | "json";

export interface ExportInfluencer {
  platform?: string;
  username?: string;
  displayName?: string;
  followers?: number;
  followersDisplay?: string;
  verified?: boolean;
  score?: number;
  highlights?: string[];
  profileUrl?: string;
  // Optional enrichment fields from engagement script
  engagementRate?: number;
  engagementRateLabel?: string;
  lastPostDate?: string;
  lastPostDaysAgo?: number;
  postsPerWeek?: number;
  isDormant?: boolean;
  suspiciousFlags?: string[];
  bioLinks?: string[];
  contentThemes?: string[];
}

export interface ExportInput {
  format?: ExportFormat;
  influencers?: ExportInfluencer[];
}

const CSV_COLUMNS: { key: string; label: string }[] = [
  { key: "platform", label: "Platform" },
  { key: "username", label: "Username" },
  { key: "displayName", label: "Display Name" },
  { key: "followers", label: "Followers" },
  { key: "verified", label: "Verified" },
  { key: "score", label: "Score" },
  { key: "engagementRateLabel", label: "Engagement Rate" },
  { key: "lastPostDate", label: "Last Post" },
  { key: "postsPerWeek", label: "Posts/Week" },
  { key: "contentThemes", label: "Themes" },
  { key: "bioLinks", label: "Bio Links" },
  { key: "suspiciousFlags", label: "Flags" },
  { key: "profileUrl", label: "Profile URL" },
];

function escapeCsv(value: unknown): string {
  if (value === undefined || value === null) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(influencers: ExportInfluencer[]): string {
  const header = CSV_COLUMNS.map((col) => col.label).join(",");
  const rows = influencers.map((inf) =>
    CSV_COLUMNS.map((col) => escapeCsv(
      col.key === "verified"
        ? inf.verified ? "Yes" : "No"
        : (inf as Record<string, unknown>)[col.key],
    )).join(","),
  );
  return [header, ...rows].join("\n");
}

export function exportToJson(influencers: ExportInfluencer[]): string {
  return JSON.stringify(influencers, null, 2);
}

export function exportInfluencers(input: ExportInput): string {
  const format = input.format ?? "csv";
  const influencers = input.influencers ?? [];
  return format === "json" ? exportToJson(influencers) : exportToCsv(influencers);
}

async function main(): Promise<void> {
  try {
    const { args, payload } = await parseCliInput<ExportInput>(
      process.argv.slice(2),
      {},
    );

    const format =
      (typeof args.format === "string" ? args.format : undefined) ??
      payload.format ??
      "csv";

    if (format !== "csv" && format !== "json") {
      printError("format must be 'csv' or 'json'");
      return;
    }

    const data = exportInfluencers({
      ...payload,
      format: format as ExportFormat,
    });

    // For CSV, output raw text (not wrapped in ok envelope) so it can be piped to a file
    if (format === "csv") {
      process.stdout.write(`${data}\n`);
    } else {
      printJson({ ok: true, data });
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  await main();
}
