import { runPoll } from "../lib/poll";

async function main() {
  const { updated, skipped, failed } = await runPoll();

  // 7. If nothing changed (no updates and no failures), say so plainly.
  if (updated === 0 && failed === 0) {
    console.log("All bills up to date");
  } else {
    // 6. Otherwise report the tally.
    console.log(`${updated} bills updated, ${skipped} bills skipped, ${failed} failed`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
