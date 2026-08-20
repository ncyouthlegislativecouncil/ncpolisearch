import Link from "next/link";

type TickerBill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
};

function truncate(text: string | null, max = 60): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function ActivityTicker({ bills }: { bills: TickerBill[] }) {
  if (bills.length === 0) return null;

  // Render the list twice so the -50% translate loops without a visible seam.
  const loop = [...bills, ...bills];

  return (
    <section className="ticker-pause overflow-hidden border-y border-gray-200 bg-white">
      <div className="flex w-max animate-ticker items-stretch">
        {loop.map((bill, i) => (
          <Link
            key={`${bill.billId}-${i}`}
            href={`/bills/${bill.billId}`}
            className="group flex shrink-0 items-center gap-3 border-r border-gray-200 px-6 py-3"
            aria-hidden={i >= bills.length ? true : undefined}
          >
            <span className="rounded bg-badge px-2 py-0.5 font-mono text-xs font-medium text-navy">
              {bill.billNumber}
            </span>
            <span className="text-sm font-medium text-navy group-hover:underline">
              {truncate(bill.title)}
            </span>
            <span className="font-mono text-xs text-navymuted">
              {bill.lastAction ? truncate(bill.lastAction, 40) : ""}
              {bill.lastActionDate ? ` · ${bill.lastActionDate}` : ""}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
