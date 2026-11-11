import { NextResponse } from "next/server";
import { allLegislators } from "../../../../lib/data/store";
import { getAllLegislatorVotes } from "../../../../lib/votes";

// Every vote a legislator cast, newest first, as one JSON file per legislator.
// Pre-built at deploy time (like the bill pages) and served straight from
// Vercel's CDN, so paging through a voting record never runs a server
// function. The profile page's pager fetches this once, on the first click.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allLegislators().map((l) => ({ id: String(l.peopleId) }));
}

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(getAllLegislatorVotes(Number(params.id)));
}
