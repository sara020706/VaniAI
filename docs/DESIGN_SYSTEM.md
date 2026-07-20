# VaniAI Design System — Redesign Brief (binding for all UI work)

A pure **visual** refactor. **Never change** business logic, API calls, prop
signatures, TanStack Query keys, routes, or ML behavior. Only change markup,
class names, layout, motion, and copy polish. Every component's existing
**props stay identical** so consuming pages keep compiling.

## Aesthetic thesis
"A control room for a student's future." Quiet, precise, editorial — think
Linear / Stripe / GitHub, NOT a generic admin template. The one memorable
signature is the **prediction gauge** (animated arc). Everything else stays
disciplined so that instrument reads as the hero. Spend boldness in one place.

## Palette — Slate & Teal (NO indigo / purple / blue — that reads as AI-default)
Use the CSS tokens, never hardcoded hex, so light/dark both work:
- `bg-background` page, `bg-card` / `.surface-card` containers, `text-foreground` / `text-muted-foreground` ink.
- `text-primary` / `bg-primary` = **deep teal** — primary actions, active nav, the gauge arc.
- `text-electric` / `text-cyan` = **jade/signal-teal** — reserve for DATA & AI/prediction moments only.
- Status (reserved, never decorative, always paired with icon+label): `text-success` (emerald), `text-warning` (amber), `text-destructive` (rose).
- Gradients: `.gradient-primary` (bg), `.gradient-text` (clipped text) — teal→jade. Use sparingly (logo, hero accent, one number).

## Surfaces & depth
- `.surface-card` — workhorse container (rounded-3xl, hairline border, `shadow-md`).
- `.glass-card` — floating chrome (topbar, menus, hero overlays).
- `.gradient-border` — the premium "AI" container (teal gradient ring). Use for AI/prediction/insight cards ONLY.
- `.hero-sheen` — radial teal sheen for hero panels. `.grid-backdrop` — dotted grid for empty/atmosphere.
- Radii: cards `rounded-3xl`/`rounded-4xl`, controls `rounded-xl`/`rounded-2xl`. Shadows via `shadow-sm|md|lg|glow`.

## Typography
Inter (loaded). Headings bold, tight tracking (already global). Big numbers use
proportional figures; use `tabular-nums` ONLY for aligned columns/axis ticks.
Generous spacing — never cramped. Section headers: small uppercase eyebrow
(`text-xs font-medium uppercase tracking-wider text-muted-foreground`) above a
bold title where it aids scanning.

## Motion (framer-motion, already a dep)
- Page transitions already in the shell. Add: card entrance stagger
  (`staggerChildren: 0.05`, item `y: 12 -> 0`, `duration: 0.3`), hover elevation
  on interactive cards (`whileHover={{ y: -2 }}` + shadow bump), gauge/ring
  animate from 0 on mount. Respect `prefers-reduced-motion` (CSS already guards).
- Fast + natural (0.2–0.35s). Don't over-animate; restraint reads as premium.

## Loading & empty
- Loading = **skeleton** shimmer (`.shimmer` util or `Skeleton` ui), never spinners.
- Empty = friendly icon in a soft `.grid-backdrop` circle, a one-line title, a
  short helpful sentence, and a primary action. Copy is directive, not sad.

## Charts (Recharts)
Keep the `useChartColors()` palette contract (it now returns teal-leaning
categorical + status). Add: gradient area/bar fills via `<linearGradient>`
(fade to transparent), `radius={[8,8,0,0]}` rounded bars (cap `maxBarSize={28}`),
2px lines with dot-on-hover, hairline grid (no vertical lines), the shared
`<ChartTooltip>` (glass, rounded-2xl, shadow-lg), legend only for ≥2 series,
animated draw-in (`isAnimationActive`), NEVER dual axes.

## Accessibility (quality floor, non-negotiable)
Visible `:focus-visible` ring (global), keyboard nav, `aria-label`s on icon
buttons, status never color-only (icon+text), contrast holds in both themes.

## Do-not-touch
`src/lib/api*.ts`, `src/hooks/*`, `src/types`, query keys, route paths, and any
data-fetching/mutation logic. If a redesign needs a value the API doesn't give,
derive it in the component — do not change the API layer.
