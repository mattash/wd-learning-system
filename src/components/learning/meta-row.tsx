import { cn } from "@/lib/utils";

interface MetaRowProps {
  lessons: number;
  duration?: string | null;
  instructor?: string | null;
  className?: string;
}

export function MetaRow({ lessons, duration, instructor, className }: MetaRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3.5 text-[12.5px] text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-85">
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
        {lessons} lesson{lessons === 1 ? "" : "s"}
      </span>
      {duration && (
        <>
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/50" />
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-85">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {duration}
          </span>
        </>
      )}
      {instructor && (
        <>
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/50" />
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-85">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
            {instructor}
          </span>
        </>
      )}
    </div>
  );
}

export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-[3px] text-[11px] font-semibold text-muted-foreground">
      {category}
    </span>
  );
}
