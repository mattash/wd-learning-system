# Design System Foundation

## Objectives
- Keep styling DRY by centralizing design decisions.
- Support theming without rewriting feature components.
- Build primitives that scale with new screens.

## Brand identity
The design system represents **St. John Armenian Apostolic Church** and its learning platform, **St. John Learning**. Armenian crimson (`oklch(38% 0.175 14)`) anchors the palette, with quiet neutral surfaces and decorative gold accents. App tokens adapt between light and dark modes.

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

## Transactional email

The shared source of truth is `src/lib/email/transactional-email.tsx` (layout, frozen tokens and plaintext structure), `transactional-content.ts` (message copy, subjects, preheaders and CTA destinations), and `build-transactional-email.tsx` (HTML/text rendering). The legacy join-request component delegates to this system.

| Email token | Frozen hex | App token / purpose |
|---|---|---|
| Crimson | `#870024` | Brand primary; links and CTA |
| Gold | `#be7c1c` | Gold; decorative rules only |
| Background | `#f3f6fa` | App background |
| Surface | `#ffffff` | Surface; CTA text |
| Primary text | `#0d151b` | Text default |
| Secondary text | `#474e54` | Text secondary; footer |
| Border | `#dbe0e5` | Border default |
| Pending / success / neutral | `#f7efe2` / `#e2f2e8` / `#f3f6fa` | Safe subtle status backgrounds with primary text |

Use Georgia / Times New Roman / Times / serif for display headings; -apple-system / BlinkMacSystemFont / Segoe UI / Roboto / Helvetica / Arial / sans-serif for body. Body copy is 16px with 26px line height; secondary/footer copy is at least 14px. Email uses inline styles and hex colors, never Tailwind, CSS variables, OKLCH, gradients or external webfonts.

Classic Outlook/Word ignores table `max-width`: the static MSO conditional style in the shared template head sets `#email-card` to `width: 600px !important`. Other clients ignore that comment and retain the responsive `width="100%"` / inline `max-width:600px` card. This conditional style is the sole exception to inline-only email styling and contains no dynamic content. MSO targeting follows the [Outlook conditional CSS pattern](https://www.cerberusemail.com/outlook).

Use a flexible, approximately 600px-wide, table-based white surface with mobile gutters, robust text/URL wrapping, a text-first St. John Learning masthead and church attribution. Reuse the navigation product mark from `app-header-client.tsx` and `public-learning-header.tsx`: a 26px crimson square with 5px rounded corners containing the centered 14px white cross/starburst. The dedicated `public/branding/st-john-learning-mark.png` is a lightweight 104×104 (4× density, under 5 KB) raster of that exact geometry, reproducible with `node scripts/generate-email-mark.mjs`. Email uses this PNG at 26×26 to the left of the product name in a presentation table, never inline SVG. Its absolute HTTPS URL is derived from the validated app origin (discarding paths, queries and fragments; upgrading HTTP for the image only). It has `alt=""` because adjacent live text names the product; the masthead remains understandable with remote images blocked. This is the shared navigation/email product mark, not a church seal; do not repurpose course art or generic icons. Use one descriptive crimson CTA with white text, plus a visible copyable URL. Gold is decorative only, never a background for white text. Status must be expressed in words, not color alone. Preserve native link focus behavior, use underlined links, `html lang="en"`, one logical h1, a hidden preheader, and presentation roles on every layout table. Text/CTA contrast must meet WCAG AA (4.5:1); do not use light muted text for the footer.

Every transactional send includes meaningful plaintext and semantic HTML generated from the same content; React escapes dynamic names/titles and CTA URLs accept only HTTP(S) without credentials. Keep subjects stable and business triggers unchanged.

| Actual transactional type | Entry point | CTA |
|---|---|---|
| Enrollment request submitted | `sendJoinRequestConfirmation` (onboarding) | `/app/catalog` |
| Enrollment request approved | `notifyJoinRequestApproved` | `/app/dashboard` |
| Enrollment request rejected | `notifyJoinRequestRejected` | `/app/catalog` |
| Manual enrollment confirmed | `notifyEnrollmentConfirmed` | `/app/dashboard` |
| Course completion | `notifyCourseCompletion` | `/app/dashboard` |

Parish-admin bulk communications are user-authored operational messages, outside this template inventory. The shared delivery provider requires text and accepts optional trusted HTML; it must never interpret the bulk body as HTML. Recipient ordering, idempotency keys, provider IDs and failure handling are independent of branding.
