import fs from "fs";
import path from "path";
import {
  buildConferenceResultFromRaw,
  isConferenceRawDataset,
} from "../lib/importConferenceRaw";

/**
 * Usage:
 *   npx tsx scripts/import-conference-snapshot.ts <handle> <attendees.json> \
 *     [--name "Event name"] [--luma https://lu.ma/...] [--venue "City"]
 *
 * Example:
 *   npx tsx scripts/import-conference-snapshot.ts romanian \
 *     data/conference_attendees/romanian/dataset_8-19-26.json \
 *     --name "Romanian Conference"
 */
function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const handleArg = args[0]?.replace(/^@/, "").trim().toLowerCase();
const jsonPath = args[1];

if (!handleArg || !jsonPath) {
  console.error(
    "Usage: npx tsx scripts/import-conference-snapshot.ts <handle> <attendees.json> [--name Name] [--luma url] [--venue City]",
  );
  process.exit(1);
}

const abs = path.resolve(jsonPath);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

const parsed: unknown = JSON.parse(fs.readFileSync(abs, "utf-8"));
if (!Array.isArray(parsed)) {
  console.error("JSON must be an array");
  process.exit(1);
}

if (!isConferenceRawDataset(parsed)) {
  console.error(
    "Unrecognized format — expected LinkedIn people-search attendee export (searchedFor + publicIdentifier)",
  );
  process.exit(1);
}

const result = buildConferenceResultFromRaw(handleArg, parsed, {
  name: argValue("--name"),
  lumaUrl: argValue("--luma"),
  venue: argValue("--venue"),
  scrapedAt: Date.now(),
  pinned: true,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handleArg}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(
  `Conference snapshot → ${result.event.name}: ${result.stats.attendeeCount} attendees`,
);
console.log(
  `  ${result.stats.matchedCount} LinkedIn matches, ${result.stats.unmatchedCount} unmatched, ${result.stats.missingCount} missing`,
);
console.log(
  `  ${result.stats.companyCount} companies, ${result.stats.locationCount} locations`,
);
for (const attendee of result.attendees) {
  const extra =
    attendee.matchStatus === "matched"
      ? `${attendee.title || "—"}${attendee.company ? ` @ ${attendee.company}` : ""}${attendee.location ? ` · ${attendee.location}` : ""}`
      : attendee.matchNote ?? attendee.matchStatus;
  console.log(`  [${attendee.matchStatus}] ${attendee.lumaName} → ${extra}`);
}
console.log(`Wrote ${outFile}`);
