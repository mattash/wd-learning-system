# St. John transactional email validation

The five existing transactional sends now use shared St. John Learning content, an inline table-based React layout, and explicit plaintext. Subjects and business triggers are unchanged. `@react-email/render` renders the standalone HTML document from Next.js server code; no email assets or webfonts are fetched during rendering.

Validation on 2026-09-08:

- Focused email and parish communication tests: 95 passed.
- Full Vitest suite: 109 files, 576 tests passed.
- Coverage: statements 78.58%, branches 66.55%, functions 74.86%, lines 81.40%. The checked-in thresholds (78/66/73/80) pass and were not modified. They differ from the repository guideline targets (85/70/80/85); this change does not resolve that existing discrepancy.
- Typecheck passed. Lint passed with nine existing warnings outside the email changes.
- Production build passed using Next's `@next/env` loader to read the existing local configuration without copying or printing secrets. Network access was needed for the app's existing Google Fonts.
- Playwright smoke suite: both tests passed using installed Chrome and local Clerk configuration. Resend credentials were removed from the test process and parish delivery disabled.
- Headless Chrome verified 40 cases: all five rendered emails at 320px and 800px, normal and long unbroken names/titles, and images loaded or blocked, without horizontal overflow. The decorative mark loads at its native 104px resolution and displays at 26px; adjacent product text remains readable when images are blocked. Representative screenshots are below. Browser previews do not establish exact rendering in every Outlook/Gmail/Apple Mail version; no live emails were sent.

The masthead now shares the exact navigation product mark as a 2,054-byte, 104×104 PNG. Its absolute HTTPS URL uses only the validated app origin, and its empty alt text avoids repeating the adjacent product name. No inline SVG or image dependency was introduced into plaintext.

Reproduce the asset with `node scripts/generate-email-mark.mjs` and the browser checks with `node --import tsx scripts/preview-transactional-emails.ts` (installed Chrome required). All ten refreshed screenshots and five HTML previews are available in `/private/tmp/st-john-email-previews` for parent review; the script intercepts image requests to serve the local asset and aborts all other remote requests. The two representative screenshots below are committed. The Outlook width follow-up regenerated the full preview set; screenshot pixels are unchanged because modern browsers ignore the MSO-only rule.

Outlook width regression: rendered-markup tests cover all five types, asserting the unique card target, responsive width, and the fixed 600px rule inside an MSO conditional comment in the document head. Five additional Chrome checks activate that rule and remove `max-width`, confirming a 600px card in a 1200px reading pane. These check fallback geometry, not native Word/Outlook rendering. The raw head markup is static; all message fields remain React-rendered and escaped.

Regression review: dynamic fields remain React-escaped; URL construction rejects non-HTTP(S) schemes and credentials. Tests assert every subject, preheader, heading, CTA destination, meaningful text, presentation-table semantics, brand colors, AA contrast and absence of generic purple. The provider adds only explicitly supplied HTML, preserving required literal text, deterministic recipient order, retry keys, provider-message IDs and error behavior. Admin bulk bodies are never interpreted as HTML.

![Submitted request at 320px](submitted-mobile.png)

![Approved request at 800px](approved-desktop.png)
