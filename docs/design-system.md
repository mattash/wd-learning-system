# Design System Foundation

## Objectives
- Keep styling DRY by centralizing design decisions.
- Support theming without rewriting feature components.
- Build primitives that scale with new screens.

## Source of truth
- Tokens and theme mappings live in `src/app/globals.css`.
- Use semantic token classes (`bg-card`, `text-muted-foreground`, `border-border`) in app code.
- Avoid raw palette classes (`text-slate-*`, `bg-white`, `text-red-*`) in feature components.
- ESLint guardrail `design-system/no-hardcoded-tailwind-palette` enforces this in `src/**/*.{ts,tsx}`.

## Theme model
- Theme is controlled by `data-theme` on the `html` element.
- Supported values today: `light`, `dark`.
- Theme toggle UI lives in `src/components/theme-toggle.tsx` and persists preference in `localStorage` (`wd-lms-theme`).

## Primitive conventions
- Keep reusable UI primitives in `src/components/ui`.
- Primitives expose small variant APIs rather than ad hoc class strings.
- Feature components should compose primitives and semantic classes, not define visual systems themselves.
- Current primitives: `Button` (Radix Slot + CVA), `Card`, `Input`, `Select`, `Alert`, `Checkbox`, `Radio`, `Dialog`, `Tabs`, `Tooltip`.
- Hidden form inputs are the only acceptable raw `<input>` usage in feature code.

## Next phase
- Expand primitive set: `Badge`, `FormField`, `Textarea`, `Popover`, `Command`.
- Add design documentation and visual regression checks.
