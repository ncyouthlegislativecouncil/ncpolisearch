import type { Metadata } from "next";
import CompareSearchPanel from "../../components/CompareSearchPanel";
import CompareBillCard from "../../components/CompareBillCard";
import { getBillForCompare, type CompareBill } from "../../lib/bills";

export const metadata: Metadata = {
  title: "Compare Bills — NCPoliSearch",
  description:
    "Compare two North Carolina bills side by side — summaries, sponsors, arguments, and votes.",
};

type SearchParams = { left?: string; right?: string };

function parseId(raw?: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Treat a bill as "passed" if its status code is Passed (4) or its most
// recent roll call passed.
function didPass(bill: CompareBill): boolean {
  return bill.status === "4" || bill.vote?.passed === true;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const leftId = parseId(searchParams.left);
  const rightId = parseId(searchParams.right);

  const [leftBill, rightBill] = await Promise.all([
    leftId ? getBillForCompare(leftId) : Promise.resolve(null),
    rightId ? getBillForCompare(rightId) : Promise.resolve(null),
  ]);

  const bothSelected = !!leftBill && !!rightBill;

  // Difference highlighting only makes sense once both are chosen.
  const statusDiffers = bothSelected && leftBill!.status !== rightBill!.status;

  let leftPass: "passed" | "failed" | null = null;
  let rightPass: "passed" | "failed" | null = null;
  if (bothSelected) {
    const lp = didPass(leftBill!);
    const rp = didPass(rightBill!);
    if (lp !== rp) {
      leftPass = lp ? "passed" : "failed";
      rightPass = rp ? "passed" : "failed";
    }
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10">
      <h1 className="font-serif text-3xl font-bold text-navy">Compare Bills</h1>
      <p className="mt-1 text-sm text-navymuted">
        Put two bills side by side — summaries, sponsors, arguments, and votes.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* LEFT */}
        {leftBill ? (
          <CompareBillCard
            bill={leftBill}
            side="left"
            otherId={rightId ?? undefined}
            statusDiffers={statusDiffers}
            passOutcome={leftPass}
          />
        ) : (
          <CompareSearchPanel
            side="left"
            left={leftId ? String(leftId) : undefined}
            right={rightId ? String(rightId) : undefined}
          />
        )}

        {/* RIGHT */}
        {rightBill ? (
          <CompareBillCard
            bill={rightBill}
            side="right"
            otherId={leftId ?? undefined}
            statusDiffers={statusDiffers}
            passOutcome={rightPass}
          />
        ) : (
          <CompareSearchPanel
            side="right"
            left={leftId ? String(leftId) : undefined}
            right={rightId ? String(rightId) : undefined}
          />
        )}
      </div>

      {!bothSelected && (
        <p className="mt-8 text-center text-sm text-navymuted">
          Select a bill in each panel to see them compared side by side.
        </p>
      )}
    </main>
  );
}
