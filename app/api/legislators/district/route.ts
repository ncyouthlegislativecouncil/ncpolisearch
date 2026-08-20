import { NextResponse } from "next/server";
import { getDistrictLegislator, type Chamber } from "../../../../lib/district";

// Returns the current legislator for a district plus the data the map's info
// panel needs (sponsored/cosponsored counts, party unity, recent bills, recent
// votes). Fetched on demand when a district is clicked, not all at once.
//
// GET /api/legislators/district?chamber=house&district=42
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chamberParam = searchParams.get("chamber");
  const districtParam = searchParams.get("district");

  const chamber: Chamber | null =
    chamberParam === "house" || chamberParam === "senate" ? chamberParam : null;
  const district = districtParam ? parseInt(districtParam, 10) : NaN;

  if (!chamber || !Number.isFinite(district)) {
    return NextResponse.json(
      { error: "chamber (house|senate) and numeric district are required" },
      { status: 400 }
    );
  }

  const legislator = await getDistrictLegislator(chamber, district);
  if (!legislator) {
    return NextResponse.json(
      { error: `No legislator found for ${chamber} district ${district}` },
      { status: 404 }
    );
  }

  return NextResponse.json({ legislator });
}
