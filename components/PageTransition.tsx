"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Wraps page content and replays a subtle fade + upward slide on every route
// change. Keying the motion element by pathname remounts it on navigation, so
// the entrance animation re-triggers each time rather than only on first load.
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      className="flex-1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
