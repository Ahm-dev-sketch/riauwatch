# Design System Master File

> **SOURCE OF TRUTH:** `frontend/src/app/globals.css`.
> This document is *derived* from that file. When the two disagree, `globals.css` wins and this file is stale — fix it, do not follow it.
>
> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, follow the rules below.

---

**Project:** RIAUWATCH
**Category:** Public environmental monitoring — Status / Incident
**Design Dials:** Variance 7/10 (Balanced) | Motion 3/10 (Subtle) | Density 8/10 (Dense / Dashboard)
**Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline`), TypeScript strict

---

## Design Intent

A **public observation instrument**, not a dashboard product. The palette is drawn from Riau's peatland fire season: dark peat rivers, burnt sienna of exposed soil, mangrove canopy green, and the amber haze (*jerebu*) that blankets the province.

Light, warm, editorial. **No dark OLED theme. No glassmorphism. No crypto aesthetics.**

---

## Color Palette

All tokens are declared in `:root` and exposed to Tailwind via `@theme inline` as `--color-rw-*`, so utilities are named `bg-rw-sienna-600`, `text-rw-peat-900`, `border-rw-smoke-200`.

### Peat — deep earth
| Token | Hex |
|---|---|
| `rw-peat-950` | `#1a1210` |
| `rw-peat-900` | `#2c1e18` |
| `rw-peat-800` | `#3d2b22` |
| `rw-peat-700` | `#5a3f30` |
| `rw-peat-600` | `#7a5840` |

### Sienna — primary action, trust, grounded authority
| Token | Hex |
|---|---|
| `rw-sienna-700` | `#8b4513` |
| `rw-sienna-600` | `#a0522d` |
| `rw-sienna-500` | `#b8652f` |
| `rw-sienna-400` | `#cd853f` |
| `rw-sienna-100` | `#f5e6d3` |
| `rw-sienna-50` | `#faf3eb` |

### Mangrove — healthy forest green, positive, clean air
| Token | Hex |
|---|---|
| `rw-mangrove-900` | `#1a3a2a` |
| `rw-mangrove-800` | `#1e4d35` |
| `rw-mangrove-700` | `#276749` |
| `rw-mangrove-600` | `#2d8659` |
| `rw-mangrove-500` | `#38a169` |
| `rw-mangrove-100` | `#c6f6d5` |
| `rw-mangrove-50` | `#f0fff4` |

### Haze — the jerebu, atmospheric amber
| Token | Hex |
|---|---|
| `rw-haze-700` | `#92400e` |
| `rw-haze-600` | `#b45309` |
| `rw-haze-500` | `#d97706` |
| `rw-haze-400` | `#f59e0b` |
| `rw-haze-100` | `#fef3c7` |
| `rw-haze-50` | `#fffbeb` |

### Status / risk — text and icon, never colour alone
| Token | Hex |
|---|---|
| `rw-red-600` | `#b91c1c` |
| `rw-red-100` | `#fee2e2` |
| `rw-orange-600` | `#c2410c` |
| `rw-orange-100` | `#ffedd5` |
| `rw-yellow-500` | `#eab308` |
| `rw-yellow-100` | `#fef9c3` |

### Smoke — neutrals
| Token | Hex |
|---|---|
| `rw-smoke-950` | `#0c0a09` |
| `rw-smoke-900` | `#1c1917` |
| `rw-smoke-800` | `#292524` |
| `rw-smoke-700` | `#44403c` |
| `rw-smoke-600` | `#57534e` |
| `rw-smoke-500` | `#78716c` |
| `rw-smoke-400` | `#a8a29e` |
| `rw-smoke-300` | `#d6d3d1` |
| `rw-smoke-200` | `#e7e5e4` |
| `rw-smoke-100` | `#f5f5f4` |
| `rw-smoke-50` | `#fafaf9` |
| `rw-white` | `#ffffff` |

**Surfaces:** `--background` = `rw-smoke-50`, `--foreground` = `rw-smoke-900`.

**Legacy aliases** exist in `@theme inline` for backward compatibility only: `rw-green-*` → mangrove, `rw-amber-*` → haze, `rw-gray-*` → smoke. Do not introduce them in new code.

### Semantic rules

| Meaning | Token family |
|---|---|
| Navigation / primary action / trust | sienna |
| Positive, healthy, active, normal | mangrove |
| Atmospheric haze, degraded air | haze |
| Incident, danger, destructive | **red — never for ordinary buttons or links** |
| Structure, text, borders, surfaces | smoke |
| Brand chrome, footer, header | peat |

Red is a signal, not a decoration. A plain "go to page" control in red reads as an alert and is a defect.

---

## Typography

| Role | Family | CSS variable | Tailwind |
|---|---|---|---|
| Display / headings | **Source Serif 4**, Georgia, serif | `--font-display` | `font-display` |
| Body / UI | **DM Sans**, system-ui, sans-serif | `--font-sans` | `font-sans` |
| Data readouts, mono | **JetBrains Mono**, monospace | `--font-mono` | `font-mono` |

Loaded through `next/font/google` in `frontend/src/app/layout.tsx` (variables `--font-source-serif`, `--font-dm-sans`, `--font-jetbrains-mono`). **No `@import url(fonts.googleapis.com)`** — self-hosted through the build, no runtime font request.

Never introduce Inter, Roboto, Arial, Open Sans, or Helvetica. `Fira Code` appears only as a monospace *fallback*, not as a loaded family.

---

## Layout, Spacing, Elevation

- **Density 8/10.** This is a monitoring surface: information must stay near the fold. There is no generous section-padding scale and none should be invented.
- **No spacing token scale exists.** Use Tailwind's default scale. Established habits: `py-3`/`px-4` inside panels, `p-5` for card interiors, `gap-5` between card rows.
- **No shadow token scale exists.** Elevation is carried by **hairline borders** — `border-rw-smoke-200` (surfaces) and `border-rw-smoke-300` (dividers). One soft shadow exists on `.rw-instrument-panel:hover`.
- `--sidebar-width: 320px`.
- Page shell: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Mobile `<768px` is always single column, full width, `px-4`.
- Use `min-h-[100dvh]`, never `h-screen` (iOS Safari viewport jump).
- Hero budget: **≤ 56vh at 1440×900, ≤ 60vh at 390×844.** The map and status cards must remain reachable without scrolling past a full screen.

---

## Motion

**Motion 3/10 — Subtle.** CSS only. No animation library, no GSAP, no Framer Motion, no `ScrollTrigger`.

Approved pattern, `.rw-hero-reveal` in `globals.css`:

```css
.rw-hero-reveal {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 400ms ease-out, transform 400ms ease-out;
}
.rw-hero-reveal.is-inview { opacity: 1; transform: translateY(0); }

@media (prefers-reduced-motion: reduce) {
  .rw-hero-reveal { opacity: 1; transform: none; transition: none; }
}
```

Driven by `IntersectionObserver` in the component. Rules:

- ✅ Fade + small rise (8–16px). Reads as a fade, not a slide.
- ✅ Animate `transform` and `opacity` only.
- ✅ Every animation has a `prefers-reduced-motion: reduce` branch that renders the final state.
- ✅ Hover transitions 150–300ms.
- ❌ No scroll event listeners, no scroll-linked interpolation.
- ❌ No `backdrop-blur` on scrolling content — only on fixed or sticky elements.
- ❌ No entry-hidden content without a no-JS/final-state fallback.

---

## Utility Classes

| Class | Purpose |
|---|---|
| `.rw-readout` | Monospace, tabular numerals, `-0.02em` tracking — all numeric data |
| `.rw-instrument-panel` | Card with 3px status-border slot + hover shadow |
| `.rw-jerebu-strip` | Atmospheric noise strip for current conditions |
| `.rw-scrollbar` | 6px scrollbar, smoke thumb |
| `.rw-mock-badge` | Pulsing indicator for mock data (animated) |
| `.rw-hero-reveal` | Entry reveal described above |
| `.skip-link` | Skip-to-content, `peat-900` on white, revealed on focus |

---

## Accessibility Contract (non-negotiable)

- **Contrast ≥ 4.5:1** for body and label text; ≥ 3:1 for large text and UI boundaries. Previously tuned pairs measure well above this — do not regress them.
- **Status is never colour alone.** Always pair colour with text and/or an icon.
- Global focus ring: `:focus-visible { outline: 2px solid var(--rw-sienna-600); outline-offset: 2px; }`
- Skip link present and functional on every page.
- Semantic landmarks, `aria-labelledby` on named sections, complete keyboard reachability in DOM order.
- Charts and numbers must have text equivalents.

---

## Content Rules

Public environmental information, **not** a government or emergency system. Satellite hotspots are **indications**, not confirmed fires.

Never write copy claiming: real-time official data, confirmed fires, government affiliation, emergency alerts, or prediction accuracy.

Always keep the indication disclaimer and the freshness/source label visible.

Numbers carry a unit. A bare figure on a public information surface is a defect — say what is counted (clusters vs raw detections) and over what window.

---

## Anti-Patterns (Do NOT Use)

- ❌ **Hardcoded hex in components** — tokens only (`bg-rw-sienna-600`, never `bg-[#a0522d]`)
- ❌ **A new hue family** — extend the existing tokens with tints/opacities
- ❌ **Dark OLED / deep-navy themes** — the system is light and warm
- ❌ **Red for primary or navigational buttons**
- ❌ Emojis as icons — use consistent SVG line icons
- ❌ Layout-shifting hover (scale that reflows neighbours)
- ❌ Low-contrast text (< 4.5:1)
- ❌ Instant state changes without interpolation
- ❌ Invisible focus states
- ❌ `backdrop-blur` on scrolling containers
- ❌ Macro-whitespace (`py-24`–`py-40`) on data-dense regions
- ❌ Slow dashboards, decorative charts, hidden error states

---

## Pre-Delivery Checklist

- [ ] Zero hex literals in component `className` (tokens only)
- [ ] Red used only for incident/danger semantics
- [ ] Numbers have units; disclaimers and freshness intact
- [ ] Contrast ≥ 4.5:1 on every new text/background pair
- [ ] Focus visible on all interactive elements
- [ ] `prefers-reduced-motion` renders the final state
- [ ] Motion is transform/opacity only; no scroll listeners
- [ ] No `backdrop-blur` on scrolling content
- [ ] Responsive at 390px, 768px, 1024px, 1440px; no horizontal scroll
- [ ] Hero within its viewport budget; data near the fold
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx playwright test` all pass
