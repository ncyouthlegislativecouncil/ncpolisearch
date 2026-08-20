"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/bills?search=${encodeURIComponent(q)}` : "/bills");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bills, topics, sponsors…"
        className="flex-1 rounded-md border border-white/20 bg-white px-5 py-3 text-navy placeholder:text-gray-400 shadow-sm focus:border-skyblue focus:outline-none focus:ring-2 focus:ring-skyblue"
      />
      <button
        type="submit"
        className="rounded-md bg-skyblue px-6 py-3 font-semibold text-navy shadow-sm transition-colors hover:bg-skyblue/90"
      >
        Search
      </button>
    </form>
  );
}
