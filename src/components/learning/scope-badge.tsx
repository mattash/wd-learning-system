import { cn } from "@/lib/utils";

export function ScopeBadge({
  scope,
  onMedia = false,
  className,
}: {
  scope: "DIOCESE" | "PARISH";
  onMedia?: boolean;
  className?: string;
}) {
  const isD = scope === "DIOCESE";
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold tracking-wide";
  const palette = isD
    ? onMedia
      ? "bg-[oklch(96%_0.04_14_/_0.92)] text-[oklch(38%_0.175_14)] backdrop-blur-sm shadow-sm"
      : "bg-tag-diocese-bg text-tag-diocese-text"
    : onMedia
      ? "bg-[oklch(100%_0_0_/_0.85)] text-[oklch(30%_0.03_245)] backdrop-blur-sm shadow-sm"
      : "bg-tag-parish-bg text-tag-parish-text";

  return (
    <span className={cn(base, palette, className)}>
      {isD ? "Diocese-wide" : "Parish"}
    </span>
  );
}
