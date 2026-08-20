"use client";

import { motion } from "framer-motion";
import BillCard from "./BillCard";

type Bill = {
  billId: number;
  billNumber: string | null;
  title: string | null;
  status: string | null;
  chamber: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  aiSummary?: string | null;
};

// Renders the /bills search results with a staggered fade-in cascade. The outer
// element is keyed by `animationKey` (a signature of the active search/filters)
// so it remounts whenever results change, replaying the cascade every time —
// not just on first load.
export default function BillResultsGrid({
  bills,
  sponsorMap,
  animationKey,
}: {
  bills: Bill[];
  sponsorMap: Record<number, string>;
  animationKey: string;
}) {
  return (
    <div key={animationKey} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bills.map((bill, i) => (
        <motion.div
          key={bill.billId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: i * 0.05 }}
        >
          <BillCard bill={bill} sponsor={sponsorMap[bill.billId]} />
        </motion.div>
      ))}
    </div>
  );
}
