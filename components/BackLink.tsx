"use client";

import { useRouter } from "next/navigation";

// A "Back" link that returns to wherever the visitor actually came from (e.g.
// a legislator's profile before they clicked into one of their bills) instead
// of always jumping to the top-level list page. Falls back to `fallbackHref`
// when there's no in-tab history to go back to (a bill opened fresh from a
// shared link, for instance).
export default function BackLink({
  fallbackHref,
  label,
}: {
  fallbackHref: string;
  label: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="text-sm text-navylight hover:text-skyblue"
    >
      {label}
    </button>
  );
}
