import { NextResponse } from "next/server";
import { searchBillsLite } from "../../../../lib/bills";

// Typeahead endpoint for the compare-page search panels.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchBillsLite(q, 8);
  return NextResponse.json({ results });
}
