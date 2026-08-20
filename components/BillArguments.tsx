// "Arguments For / Against" block shown beneath the plain-language summary on a
// bill page. Two always-visible cards side by side: in-favor (green left
// border) and against (crimson left border). Both arguments are optional; the
// block only renders if there's at least one to show.
export default function BillArguments({
  pro,
  con,
}: {
  pro: string | null;
  con: string | null;
}) {
  if (!pro && !con) return null;

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {pro && (
        <div className="rounded-lg border border-gray-200 border-l-4 border-l-lowrisk bg-white p-5 shadow-sm">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-lowrisk">
            Arguments in Favor
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{pro}</p>
        </div>
      )}
      {con && (
        <div className="rounded-lg border border-gray-200 border-l-4 border-l-ncred bg-white p-5 shadow-sm">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-ncred">
            Arguments Against
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{con}</p>
        </div>
      )}
    </div>
  );
}
