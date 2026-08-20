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
}: {
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  width?: number;
  height?: number;
  circle?: boolean;
  className?: string;
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
        className={`${base} bg-badge object-cover ${className}`}
        style={{ width: w, height: h }}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center bg-badge font-mono font-bold text-navylight ${base} ${className}`}
      style={{ width: w, height: h, fontSize: Math.round(Math.min(w, h) / 3) }}
    >
      {initials(name)}
    </span>
  );
}
