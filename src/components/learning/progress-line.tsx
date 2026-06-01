import { cn } from "@/lib/utils";

export function ProgressLine({
  percent,
  showPercent = true,
  className,
}: {
  percent: number;
  showPercent?: boolean;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("flex items-center gap-2.5 text-[12.5px] text-muted-foreground", className)}>
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${clamped}%`,
            background: "linear-gradient(90deg, var(--ds-color-brand-primary), var(--ds-color-brand-muted))",
          }}
        />
      </div>
      {showPercent && (
        <span className="min-w-[34px] text-right font-semibold text-foreground/70">
          {clamped}%
        </span>
      )}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 56,
}: {
  percent: number;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const off = c - (clamped / 100) * c;
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ds-color-bg-muted)"
          strokeWidth="5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ds-color-brand-primary)"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute font-display text-[14px] font-bold">
        {clamped}%
      </span>
    </div>
  );
}
