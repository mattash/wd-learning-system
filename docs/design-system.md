# Design System Foundation

## Objectives
- Keep styling DRY by centralizing design decisions.
- Support theming without rewriting feature components.
- Build primitives that scale with new screens.

## Brand identity
The design system is derived from the **Western Diocese of the Armenian Church** brand. Armenian crimson (`oklch(38% 0.175 14)`) anchors the palette. Warm-neutral surfaces and a gold accent provide depth. All tokens adapt between light and dark modes.

## Source of truth
- Tokens and theme mappings live in `src/app/globals.css`.
- Use semantic token classes (`bg-card`, `text-muted-foreground`, `border-border`) in app code.
- Avoid raw palette classes (`text-slate-*`, `bg-white`, `text-red-*`) in feature components.
- ESLint guardrail `design-system/no-hardcoded-tailwind-palette` enforces this in `src/**/*.{ts,tsx}`.

## Color tokens

### Brand
| Token | Purpose |
|---|---|
| `--ds-color-brand-primary` | Armenian crimson — primary action color |
| `--ds-color-brand-hover` | Hover state for primary |
| `--ds-color-brand-active` | Active/pressed state for primary |
| `--ds-color-brand-subtle` | Tinted backgrounds (selected states, hover fills) |
| `--ds-color-brand-muted` | Muted crimson for secondary accents |

### Semantic status
| Token | Usage |
|---|---|
| `--ds-color-success` / `success-subtle` | Completed, active, positive states |
| `--ds-color-warning` / `warning-subtle` | Stalled, needs-attention states |
| `--ds-color-destructive` / `destructive-subtle` | Error, not-started, danger states |
| `--ds-color-gold` / `gold-subtle` | Featured or celebratory actions |

### Surface & text
Tokens like `--ds-color-bg-app`, `--ds-color-bg-surface`, `--ds-color-text-default`, `--ds-color-text-muted` etc. automatically adapt between light and dark modes via `data-theme` on the root element.

## Typography
- **Display / Headings:** Merriweather (serif) — institutional gravitas. Use via `font-display` class.
- **Body / UI:** Source Sans 3 (sans-serif) — readable at small sizes. Default `font-sans`.
- Fonts are loaded via `next/font/google` in `src/app/layout.tsx`.

### Type scale
| Role | Family | Size | Weight |
|---|---|---|---|
| Display | Merriweather | 36px | 700 |
| H1 | Merriweather | 28px | 700 |
| H2 | Merriweather | 22px | 700 |
| H3 | Merriweather | 18px | 400 italic |
| Body Large | Source Sans 3 | 16px | 400 |
| Body Default | Source Sans 3 | 14px | 400 |
| Label | Source Sans 3 | 13px | 600 |
| Caption | Source Sans 3 | 11px | 700 uppercase |
| Hint / Error | Source Sans 3 | 12px | 400 |

## Spacing & radii
- **Spacing:** 4px base unit (xs=4, sm=8, md=12, lg=16, xl=20, 2xl=28, 3xl=48).
- **Radii:** sm=4px, md=8px, lg=12px, xl=16px, pill=999px.

## Theme model
- Theme is controlled by `data-theme` on the `html` element.
- Supported values today: `light`, `dark`.
- Theme toggle UI lives in `src/components/theme-toggle.tsx` and persists preference in `localStorage` (`wd-lms-theme`).

## Primitive conventions
- Keep reusable UI primitives in `src/components/ui`.
- Primitives expose small variant APIs rather than ad hoc class strings.
- Feature components should compose primitives and semantic classes, not define visual systems themselves.
- Hidden form inputs are the only acceptable raw `<input>` usage in feature code.

### Available primitives

| Component | Variants | File |
|---|---|---|
| `Button` | default, secondary, outline, ghost, link, destructive, destructive-outline, gold · xs/sm/default/lg/xl/icon | `button.tsx` |
| `Badge` | default, parish, diocese, role, success, warning, danger | `badge.tsx` |
| `ProgressBar` | default, success, warning | `progress-bar.tsx` |
| `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter | `card.tsx` |
| `Input` | — | `input.tsx` |
| `Select` | — (includes dropdown caret) | `select.tsx` |
| `Textarea` | — | `textarea.tsx` |
| `Checkbox` | — | `checkbox.tsx` |
| `Radio` | — | `radio.tsx` |
| `Alert` | default, destructive, success, warning | `alert.tsx` |
| `Tabs` | TabsList (pill tabs), TabsTrigger, TabsContent | `tabs.tsx` |
| `Dialog` | — (Radix-based) | `dialog.tsx` |
| `Tooltip` | — (Radix-based) | `tooltip.tsx` |

## Button usage guidelines
- **Primary (default):** One per section. The single most important action.
- **Secondary:** Supporting or alternative actions alongside primary.
- **Ghost:** Low-emphasis actions — Cancel, Dismiss, nav items.
- **Destructive / Destructive Outline:** Irreversible actions. Pair with confirmation. Use outline for reversible removals.
- **Gold:** Reserved for milestone or featured actions — Adopt course, onboarding CTA.

## Badge usage guidelines
- **Parish / Diocese:** Scope indicators on courses and content.
- **Role:** User role display (Parish Admin, Diocese Admin).
- **Success / Warning / Danger:** Status indicators (Completed, Stalled, Not started).

## Next phase
- Add visual regression checks.
- `Popover`, `Command` primitives.
