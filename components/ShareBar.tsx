"use client";

import { useState } from "react";

export default function ShareBar({
  billNumber,
  title,
}: {
  billNumber: string | null;
  title: string | null;
}) {
  const [copied, setCopied] = useState(false);

  // The canonical URL is whatever the visitor is currently viewing.
  function currentUrl(): string {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function copyLink() {
    const url = currentUrl();
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard can be blocked (e.g. insecure context); fail quietly.
      });
  }

  function shareToX() {
    const url = currentUrl();
    const text = `${billNumber ?? "Bill"}: ${title ?? ""}`.trim();
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareToFacebook() {
    const url = currentUrl();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const btn =
    "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copyLink}
        className={`${btn} ${copied ? "bg-lowrisk" : "bg-navy"}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
        {copied ? "Link copied!" : "Copy link"}
      </button>

      <button type="button" onClick={shareToX} className={`${btn} bg-gray-900`}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
        Share on X
      </button>

      <button type="button" onClick={shareToFacebook} className={`${btn} bg-[#1877f2]`}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
        </svg>
        Facebook
      </button>
    </div>
  );
}
