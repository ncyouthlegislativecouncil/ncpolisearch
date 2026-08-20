import { config } from "dotenv";
config({ path: ".env.local" });

import { getSessionList, type Session } from "../lib/legiscan";

async function main() {
  const sessions = await getSessionList("NC");

  console.log(`Found ${sessions.length} NC sessions:\n`);
  for (const s of sessions) {
    console.log(
      `  session_id=${s.session_id}  ${s.year_start}-${s.year_end}  ${s.session_name}`
    );
  }

  const current: Session | undefined = sessions.find(
    (s) => s.year_start === 2025 && s.year_end === 2026
  );

  console.log("");
  if (current) {
    console.log(
      `Current 2025-2026 session_id: ${current.session_id} (${current.session_name})`
    );
  } else {
    console.log("No 2025-2026 session found.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
