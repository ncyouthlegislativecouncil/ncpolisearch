import { Suspense } from "react";
import LegislatorCard from "../../components/LegislatorCard";
import LegislatorFilterBar from "../../components/LegislatorFilterBar";
import { getLegislators } from "../../lib/legislators";

type SearchParams = {
  chamber?: string;
  party?: string;
};

export default async function LegislatorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const list = await getLegislators({
    chamber: searchParams.chamber,
    party: searchParams.party,
  });

  const house = list.filter((leg) => leg.role === "Rep");
  const senate = list.filter((leg) => leg.role === "Sen");
  const other = list.filter((leg) => leg.role !== "Rep" && leg.role !== "Sen");

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <h1 className="font-serif text-3xl font-bold text-navy">NC Legislators</h1>
      <p className="mt-1 text-sm text-navymuted">
        North Carolina General Assembly · 2025–2026 session
      </p>

      <div className="mt-6">
        <Suspense fallback={<div className="h-16" />}>
          <LegislatorFilterBar />
        </Suspense>
      </div>

      <p className="mt-6 text-sm text-navymuted">
        {list.length === 0
          ? "No legislators found"
          : `${list.length} legislator${list.length === 1 ? "" : "s"}`}
      </p>

      {list.length > 0 ? (
        <div className="mt-2">
          {(() => {
            const sideBySide = house.length > 0 && senate.length > 0;
            return (
              <>
                <div className={sideBySide ? "grid gap-x-8 lg:grid-cols-2" : ""}>
                  {house.length > 0 && (
                    <ChamberSection
                      title="House"
                      legislators={house}
                      compact={sideBySide}
                    />
                  )}
                  {senate.length > 0 && (
                    <ChamberSection
                      title="Senate"
                      legislators={senate}
                      compact={sideBySide}
                    />
                  )}
                </div>
                {other.length > 0 && (
                  <ChamberSection title="Other" legislators={other} />
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <p className="mt-10 text-center text-navymuted">
          Try adjusting your filters.
        </p>
      )}
    </main>
  );
}

type LegislatorRow = {
  peopleId: number;
  name: string | null;
  party: string | null;
  role: string | null;
  district: string | null;
  imageUrl: string | null;
};

function ChamberSection({
  title,
  legislators,
  compact = false,
}: {
  title: string;
  legislators: LegislatorRow[];
  compact?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-navy">
        {title}{" "}
        <span className="text-base font-normal text-navymuted">
          ({legislators.length})
        </span>
      </h2>
      <div
        className={`mt-4 grid gap-4 ${
          compact ? "sm:grid-cols-2 xl:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {legislators.map((leg) => (
          <LegislatorCard key={leg.peopleId} leg={leg} />
        ))}
      </div>
    </section>
  );
}
