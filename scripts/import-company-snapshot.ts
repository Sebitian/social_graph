import fs from "fs";
import path from "path";
import {
  buildCompanyResultFromRaw,
  isCompanyRawDataset,
} from "../lib/importCompanyRaw";

/**
 * Usage:
 *   npx tsx scripts/import-company-snapshot.ts <handle> <company-employees.json>
 *
 * Example:
 *   npx tsx scripts/import-company-snapshot.ts formationbio \
 *     data/linkedin_raw/company/dataset_linkedin-company-employees_2026-08-08_19-15-29-629.json
 */
const args = process.argv.slice(2);
const handleArg = args[0]?.replace(/^@/, "").trim().toLowerCase();
const jsonPath = args[1];

if (!handleArg || !jsonPath) {
  console.error(
    "Usage: npx tsx scripts/import-company-snapshot.ts <handle> <company-employees.json>",
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

if (!isCompanyRawDataset(parsed)) {
  console.error(
    "Unrecognized format — expected HarvestAPI company employee search export",
  );
  process.exit(1);
}

const result = buildCompanyResultFromRaw(handleArg, parsed, {
  scrapedAt: Date.now(),
  pinned: true,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handleArg}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(
  `Company snapshot → ${result.company.name}: ${result.stats.employeeCount} employees` +
    (result.stats.totalReported
      ? ` (${result.stats.totalReported} reported on LinkedIn)`
      : ""),
);
console.log(
  `  ${result.stats.locationCount} locations, ${result.stats.schoolCount} schools, ~${result.stats.avgConnections} avg connections`,
);
console.log(`Wrote ${outFile}`);
