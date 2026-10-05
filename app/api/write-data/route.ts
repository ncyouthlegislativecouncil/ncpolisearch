import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { bills } from "../../../db/schema";
import { getLegislators } from "../../../lib/legislators";
import { districtNumber } from "../../../lib/legislator-display";
import emails from "../../../lib/legislator-emails.json";

// Feeds the /write page's bill and legislator pickers. The page searches these
// lists in the browser, so typing never touches the database. This response is
// cached at the edge for a day (bills only change when the daily poll runs), so
// the database is queried roughly once a day regardless of how many people use
// the page. force-dynamic (rather than prerendering) keeps the build from
// depending on the database being reachable.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [billRows, legRows] = await Promise.all([
      db
        .select({ id: bills.billId, n: bills.billNumber, t: bills.title })
        .from(bills)
        .orderBy(sql`${bills.lastActionDate} DESC NULLS LAST`),
      getLegislators({}),
    ]);

    const emailById = emails as Record<string, string>;
    // Only legislators we have an official email for can be written to.
    const legislators = legRows
      .filter((l) => emailById[String(l.peopleId)])
      .map((l) => ({
        id: l.peopleId,
        name: l.name ?? "",
        role: l.role ?? "",
        district: districtNumber(l.district),
        party: l.party,
        email: emailById[String(l.peopleId)],
      }));

    return NextResponse.json(
      {
        bills: billRows.map((b) => ({ id: b.id, n: b.n ?? "", t: b.t ?? "" })),
        legislators,
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (err) {
    console.error("write-data failed:", (err as Error).message);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
