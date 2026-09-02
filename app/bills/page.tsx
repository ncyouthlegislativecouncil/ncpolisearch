import { Suspense } from "react";
import Link from "next/link";
import BillResultsGrid from "../../components/BillResultsGrid";
import FilterBar from "../../components/FilterBar";
import { getBills } from "../../lib/bills";

type SearchParams = {
  search?: string;
  chamber?: string;
  status?: string;
  party?: string;
  topic?: string;
  sort?: string;
  page?: string;
};

function buildQuery(params: SearchParams, page: number) {
  const next = new URLSearchParams();
  if (params.search) next.set("search", params.search);
  if (params.chamber) next.set("chamber", params.chamber);
  if (params.status) next.set("status", params.status);
  if (params.party) next.set("party", params.party);
  if (params.topic) next.set("topic", params.topic);
  if (params.sort) next.set("sort", params.sort);
  if (page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `/bills?${qs}` : "/bills";
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const pageSize = 24;

  const { bills, total, sponsorMap } = await getBills({
    search: searchParams.search,
    chamber: searchParams.chamber,
    status: searchParams.status,
    party: searchParams.party,
    topic: searchParams.topic,
    sort: searchParams.sort,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Signature of the active query — changes whenever the search or filters
  // change, which remounts the results grid and replays the fade-in cascade.
  const animationKey = [
    searchParams.search ?? "",
    searchParams.chamber ?? "",
    searchParams.status ?? "",
    searchParams.party ?? "",
    searchParams.topic ?? "",
    searchParams.sort ?? "",
    page,
  ].join("|");

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <h1 className="font-serif text-3xl font-bold text-navy">Bills</h1>
      <p className="mt-1 text-sm text-navymuted">
        North Carolina General Assembly · 2025–2026 session
      </p>

      <div className="mt-6">
        <Suspense fallback={<div className="h-16" />}>
          <FilterBar />
        </Suspense>
      </div>

      <p className="mt-6 text-sm text-navymuted">
        {total === 0 ? "No bills found" : `Showing ${start}–${end} of ${total.toLocaleString()} bills`}
      </p>

      {bills.length > 0 ? (
        <BillResultsGrid
          bills={bills}
          sponsorMap={sponsorMap}
          animationKey={animationKey}
        />
      ) : (
        <p className="mt-10 text-center text-navymuted">
          Try adjusting your search or filters.
        </p>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={buildQuery(searchParams, page - 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-navy hover:border-skyblue"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded-md border border-gray-200 px-3 py-2 text-gray-300">
              ← Prev
            </span>
          )}

          <span className="px-3 py-2 font-mono text-navylight">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={buildQuery(searchParams, page + 1)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-navy hover:border-skyblue"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-md border border-gray-200 px-3 py-2 text-gray-300">
              Next →
            </span>
          )}
        </nav>
      )}
    </main>
  );
}
