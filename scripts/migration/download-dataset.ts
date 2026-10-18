import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { writeFileSync } from "fs";
import { getDataset, getDatasetList } from "../../lib/legiscan";

// Downloads LegiScan's bulk dataset (every bill in the NC 2025-2026 session,
// with official sponsor order) as a zip into backup/. Two API calls total.
async function main() {
  const list = await getDatasetList("NC");
  const ds = list.find((d) => d.year_start === 2025 && d.year_end === 2026);
  if (!ds) throw new Error("No 2025-2026 NC dataset");
  const dataset = await getDataset(ds.session_id, ds.access_key);
  writeFileSync("backup/legiscan-nc-2025.zip", Buffer.from(dataset.zip, "base64"));
  console.log(`saved dataset (dataset_date ${ds.dataset_date})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
