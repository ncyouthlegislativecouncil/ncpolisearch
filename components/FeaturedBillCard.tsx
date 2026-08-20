import Link from "next/link";
import { chamberLabel, statusInfo } from "../lib/status";

type FeaturedBill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  lastActionDate: string | null;
  aiSummary: string | null;
  sponsor: string | null;
};

// The large left-hand card in the homepage "What's Moving in Raleigh" block.
// Navy header strip with a gold "Featured" flag, then a roomy body that
// surfaces the AI plain-language summary when one exists.
export default function FeaturedBillCard({ bill }: { bill: FeaturedBill }) {
  const status = statusInfo(bill.status ?? "");
  return (
    <Link
      href={`/bills/${bill.billId}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-skyblue hover:shadow-md"
    >
      <div className="flex items-center justify-between bg-navy px-5 py-3">
        <span className="rounded bg-skyblue px-2 py-1 font-mono text-xs font-bold text-navy">
          {bill.billNumber}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-gold">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" />
          </svg>
          Featured
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
            {status.label}
          </span>
          <span className="text-xs text-navymuted">{chamberLabel(bill.chamber)}</span>
        </div>

        <h3 className="mt-3 font-serif text-xl font-bold leading-snug text-navy group-hover:text-navylight">
          {bill.title}
        </h3>

        {bill.sponsor && (
          <p className="mt-2 text-xs text-navylight">
            Introduced by <span className="font-medium text-navy">{bill.sponsor}</span>
          </p>
        )}

        {bill.aiSummary && (
          <p className="mt-3 line-clamp-4 border-l-2 border-skyblue pl-3 text-sm leading-relaxed text-gray-600">
            {bill.aiSummary}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-navymuted">
          {bill.lastActionDate && <span className="font-mono">{bill.lastActionDate}</span>}
          <span className="font-semibold text-navy group-hover:text-skyblue">Read analysis →</span>
        </div>
      </div>
    </Link>
  );
}
