import Image from "next/image";
import { initials } from "../lib/legislator-display";

// Legislator avatar. Shows the profile photo when image_url is set, otherwise
// falls back to the monogram initials placeholder.
//
// Pass `size` for a square/circular avatar (cards), or `width`+`height` for a
// rectangular photo (profile header). `circle` toggles between a round bubble
// and a rounded rectangle.
export default function LegislatorAvatar({
  name,
  imageUrl,
  size,
  width,
  height,
  circle = true,
  className = "",
  sizeClassName,
}: {
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  width?: number;
  height?: number;
  circle?: boolean;
  className?: string;
  // Tailwind width/height classes (e.g. responsive breakpoints) that drive the
  // RENDERED size instead of the width/height props. Those props still get
  // passed to next/image for its required intrinsic dimensions/optimization,
  // but an inline style would otherwise always win over CSS classes, which is
  // exactly why the profile-header photo couldn't shrink on mobile before.
  sizeClassName?: string;
}) {
  const w = width ?? size ?? 48;
  const h = height ?? size ?? w;
  const shape = circle ? "rounded-full" : "rounded-md";
  const base = `flex-none overflow-hidden border-2 border-badge ${shape}`;

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name ?? "Legislator photo"}
        width={w}
        height={h}
        className={`${base} bg-badge object-cover ${sizeClassName ?? ""} ${className}`}
        style={sizeClassName ? undefined : { width: w, height: h }}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center bg-badge font-mono font-bold text-navylight ${base} ${sizeClassName ?? ""} ${className}`}
      style={
        sizeClassName
          ? { fontSize: Math.round(Math.min(w, h) / 3) }
          : { width: w, height: h, fontSize: Math.round(Math.min(w, h) / 3) }
      }
    >
      {initials(name)}
    </span>
  );
}
