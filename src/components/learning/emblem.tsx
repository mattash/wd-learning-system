import * as React from "react";

import { cn } from "@/lib/utils";

type EmblemKind = "rays" | "cross" | "book" | "candle";

interface Palette {
  a: string;
  b: string;
  glow: string;
  glyph: EmblemKind;
}

const PALETTES: Palette[] = [
  { a: "oklch(34% 0.13 18)", b: "oklch(18% 0.07 25)", glow: "oklch(62% 0.15 70)", glyph: "rays" },
  { a: "oklch(30% 0.05 250)", b: "oklch(17% 0.04 260)", glow: "oklch(58% 0.12 75)", glyph: "cross" },
  { a: "oklch(40% 0.09 55)", b: "oklch(22% 0.06 45)", glow: "oklch(66% 0.13 78)", glyph: "book" },
  { a: "oklch(33% 0.1 28)", b: "oklch(19% 0.06 30)", glow: "oklch(60% 0.14 68)", glyph: "candle" },
];

function paletteFor(seed: string): Palette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

function Glyph({ kind }: { kind: EmblemKind }) {
  const stroke = "oklch(82% 0.11 78)";
  if (kind === "cross") {
    return (
      <svg viewBox="0 0 40 40" className="emblem-glyph">
        <rect x="17" y="6" width="6" height="28" rx="1.5" fill={stroke} />
        <rect x="9" y="14" width="22" height="6" rx="1.5" fill={stroke} />
      </svg>
    );
  }
  if (kind === "book") {
    return (
      <svg viewBox="0 0 40 40" className="emblem-glyph" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round">
        <path d="M20 11c-3-2-7-2-10-1v19c3-1 7-1 10 1 3-2 7-2 10-1V10c-3-1-7-1-10 1Z" />
        <path d="M20 11v18" />
      </svg>
    );
  }
  if (kind === "candle") {
    return (
      <svg viewBox="0 0 40 40" className="emblem-glyph">
        <rect x="17" y="16" width="6" height="18" rx="1.5" fill={stroke} />
        <path d="M20 6c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6Z" fill={stroke} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="emblem-glyph">
      <circle cx="20" cy="20" r="6" fill={stroke} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 20 + 10 * Math.cos(a);
        const y1 = 20 + 10 * Math.sin(a);
        const x2 = 20 + 15 * Math.cos(a);
        const y2 = 20 + 15 * Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function Emblem({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const p = paletteFor(seed);
  const style: React.CSSProperties = {
    background: `radial-gradient(120% 90% at 50% 18%, ${p.glow} 0%, transparent 55%), linear-gradient(160deg, ${p.a} 0%, ${p.b} 100%)`,
  };
  return (
    <div className={cn("relative grid h-full w-full place-items-center overflow-hidden", className)} style={style}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[9%] rounded-full"
        style={{
          border: "1.5px solid oklch(78% 0.11 75 / 0.32)",
          WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)",
          mask: "radial-gradient(circle, transparent 62%, #000 63%)",
        }}
      />
      <Glyph kind={p.glyph} />
    </div>
  );
}

export function CourseThumbnail({
  seed,
  thumbnailUrl,
  alt,
  className,
}: {
  seed: string;
  thumbnailUrl?: string | null;
  alt: string;
  className?: string;
}) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        src={thumbnailUrl}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return <Emblem seed={seed} className={className} />;
}
