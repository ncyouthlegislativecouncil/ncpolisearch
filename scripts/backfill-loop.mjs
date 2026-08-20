import { spawnSync } from "node:child_process";

// The backfill degrades after a few minutes of steady load against Neon's
// free tier, but it's resumable from the database. So run it in fresh
// processes repeatedly until a pass completes with zero failures (exit 0).
const MAX_PASSES = 20;

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  console.log(`\n===== Backfill pass ${pass}/${MAX_PASSES} =====`);
  const res = spawnSync(
    "npx",
    ["tsx", "--env-file=.env.local", "scripts/backfill.ts"],
    { stdio: "inherit", shell: true }
  );

  if (res.status === 0) {
    console.log(`\nBackfill completed cleanly on pass ${pass}.`);
    process.exit(0);
  }
  console.log(`Pass ${pass} ended with code ${res.status}; starting a fresh pass.`);
}

console.log(`\nReached ${MAX_PASSES} passes without a clean finish — re-run to continue.`);
process.exit(1);
