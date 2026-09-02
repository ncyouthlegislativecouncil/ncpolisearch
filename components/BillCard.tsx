import Link from "next/link";
import { chamberLabel, statusInfo } from "../lib/status";

type Bill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  aiSummary?: string | null;
  topic?: string | null;
};

export default function BillCard({ bill, sponsor }: { bill: Bill; sponsor?: string }) {
  const status = statusInfo(bill.status ?? "");
  return (
    <Link
      href={`/bills/${bill.billId}`}
      className="flex h-full flex-col rounded-md border border-gray-200 bg-white p-5 transition-all hover:border-skyblue hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-badge px-2.5 py-1 font-mono text-sm font-semibold text-navy">
          {bill.billNumber}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 font-serif text-xl font-bold leading-snug text-navy">
        {bill.title}
      </h3>

      {sponsor && (
        <p className="mt-2 text-sm text-navylight">
          Introduced by <span className="font-semibold text-navy">{sponsor}</span>
        </p>
      )}

      {bill.aiSummary && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">
          {bill.aiSummary}
        </p>
      )}

      {bill.topic && (
        <p className="mt-2 text-xs font-medium text-skyblue">{bill.topic}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-navymuted">
        <span className="font-medium">{chamberLabel(bill.chamber)}</span>
        {bill.lastActionDate && <span className="font-mono">{bill.lastActionDate}</span>}
      </div>
    </Link>
  );
}
