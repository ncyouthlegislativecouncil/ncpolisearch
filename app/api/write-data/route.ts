import { NextResponse } from "next/server";
import { getBillsForPicker } from "../../../lib/bills";
import { getLegislators } from "../../../lib/legislators";
import { districtNumber } from "../../../lib/legislator-display";
import emails from "../../../lib/legislator-emails.json";

// Feeds the /write page's bill and legislator pickers. The page searches these
// lists in the browser, so typing never hits the server. Built once at deploy
// time from the data files and served from the CDN as a static file.
export const dynamic = "force-static";

export async function GET() {
  const emailById = emails as Record<string, string>;
  // Only legislators we have an official email for can be written to.
  const legislators = (await getLegislators({}))
    .filter((l) => emailById[String(l.peopleId)])
    .map((l) => ({
      id: l.peopleId,
      name: l.name ?? "",
      role: l.role ?? "",
      district: districtNumber(l.district),
      party: l.party,
      email: emailById[String(l.peopleId)],
    }));

  return NextResponse.json({ bills: getBillsForPicker(), legislators });
}
