# Handoff: Dwelling Dream — Premium Color Palette Storefront

## Overview

Dwelling Dream is a premium digital brand selling curated interior paint palettes as instant-download PDF bundles. This handoff covers a complete five-page marketing + commerce front end:

| Page | File | Purpose |
|---|---|---|
| Homepage | `Dwelling Dream Homepage v2.dc.html` | Photography-led landing page — hero, best sellers, palette inspiration, style explorer, guide bundle, before/after, about, social proof, CTA |
| Palettes | `Dwelling Dream Palettes.dc.html` | Catalogue of palettes, filterable by paint brand |
| Product | `Dwelling Dream Product.dc.html` | Single-palette PDP with gallery, buy box, accordion details, recommendations |
| About | `Dwelling Dream About.dc.html` | Founder story + color philosophy + newsletter |
| Help | `Dwelling Dream Help.dc.html` | FAQ, downloads, terms, privacy, refunds, licensing |

The emotional target: *a luxury interior-design magazine crossed with a digital color studio*. Editorial, warm, photography-first, restrained motion. Explicitly **not** a SaaS landing page, not a Shopify template, not a Pinterest grid.

---

## About the Design Files

The `.dc.html` files in this bundle are **design references created in HTML** — prototypes that show intended look, layout, motion and behavior. They are **not production code to copy directly**.

They are authored in a proprietary streaming-component format (`<x-dc>` template + a `Component extends DCLogic` class, all styling inline). Do not attempt to port that runtime.

**Your task is to recreate these designs in the target codebase's existing environment** — React/Next.js, Vue/Nuxt, Astro, Shopify Hydrogen, etc. — using its established component patterns, styling solution and routing. If no codebase exists yet, pick the most appropriate framework (for this project: **Next.js + Tailwind**, or **Astro** if it stays mostly static, with a commerce backend such as Shopify/Stripe/Lemon Squeezy for the digital downloads) and implement there.

Read each HTML file for exact structure and inline styles; use this README as the authoritative spec.

### `interactions.js` — the behaviour, extracted and portable

The bundle includes **`interactions.js`**: a dependency-free ES module that implements every interaction described below, lifted out of the prototypes and rewritten as framework-agnostic functions. This is the part that is genuinely reusable — the HTML is a reference, but this JS can be dropped straight into a build.

```js
import { initDwellingDream } from './interactions.js';
const teardown = initDwellingDream();     // wires whatever markup is present
```

Or call the pieces individually — useful in React/Vue, where each returns its own teardown:

```js
useEffect(() => initStyleExplorer(ref.current, { names: STYLES.map(s => s.name) }), []);
```

Exported: `initScrollProgress`, `initNav`, `initReveal`, `initCounters`, `initCursorParallax`, `initMagnetic`, `initHeroParallax`, `initSectionParallax`, `initStyleExplorer`, `initHoverCards`, `initTestimonials`, `initComparisonSlider`, `initAccordions`, `initBrandFilter`, `initPaletteModal`, `initSwatches`, `initProductGallery`, `initCart`, `initNewsletter`, `initResponsiveGrids`, plus the data constants `PALETTES`, `STYLES`, `TESTIMONIALS` and helpers `isDarkHex`, `copyText`, `prefersReducedMotion`.

Every function is safe to call when its markup is absent, respects `prefers-reduced-motion`, and returns a teardown that removes its listeners and observers. Each is preceded by a comment documenting the exact `data-*` markup contract it expects, so you can either match the attributes or read the function as a spec and reimplement it idiomatically.

Two deliberate porting notes are flagged in the file: `initResponsiveGrids` should be **deleted** in favour of CSS media queries (it only exists because the prototype was limited to inline styles), and `initCart` is a **visual stub** to be replaced by real commerce state.

## Fidelity

**High fidelity (hifi).** Final colors, typography, spacing, copy and interaction timing. Recreate pixel-accurately using the target codebase's libraries.

Two caveats:
1. **All photography is placeholder.** Every image is a drag-and-drop `<image-slot>` component with a written brief for what belongs there. In production these become real `<img>` / `next/image` elements. Slot IDs and their briefs are listed under **Assets**.
2. **Cart is a visual stub.** The header cart increments a counter only; no persistence, no checkout. Wire it to real commerce.

---

## Design Tokens

### Color

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F5F2EA` | Page background (warm off-white) |
| `bg-alt` | `#EDEAE0` | Alternating section background, card fills |
| `bg-sunken` | `#E3DED3` | Empty image-slot placeholder fill |
| `ink` | `#292825` | Body text, dark sections, primary buttons |
| `ink-soft` | `#3F3D37` | Primary button hover |
| `muted` | `#78736E` | Secondary text, eyebrows |
| `muted-2` | `#5F5A54` | Long-form body copy |
| `muted-3` | `#6E675E` | Card body copy |
| `faint` | `#A9A29A` | Tertiary labels, meta |
| `inactive` | `#8E8880` / `#9B958D` | Inactive style-list items |
| `border` | `#D8D2C8` | Hairlines, outline buttons |
| `border-2` | `#DDD7CC` | List row dividers inside cards |
| `on-dark` | `#F5F2EA` | Text on `ink` |
| `on-dark-muted` | `rgba(245,242,234,.84)` | Body text on `ink` |
| `on-dark-faint` | `rgba(245,242,234,.7)` | Eyebrows on `ink` |
| `accent` | `#817A6E` | Link hover, focus ring, scroll progress bar |

Accents used decoratively (from palette content): `#DFD3C3` linen, `#C2DAE0` pale aqua, `#9BBFC9` coastal mist, `#ACAD97` dried sage, `#AC6B53` terracotta, `#EBD1CF` faded rose.

### Palette data (product content — hex values are exact and must not be altered)

**Currently shipped (Sherwin Williams):**

- **Sea Salt** — `#DCDDD8 #EDEAE0 #F0E1D8 #D1C7B8 #CDD2CA #C8CBC4 #596E79 #2F3D4C #434341`
  *Cool ivory and sea glass, grounded by deep navy and charcoal.*

**Other palettes referenced across the site (homepage inspiration panels + style explorer):**

| Name | Nine hex values |
|---|---|
| Greek Villa | `#EDECE6 #F0ECE2 #DFD3C3 #C8BCAB #95978A #CDD2CA #708D9E #7B8070 #5D6F7F` |
| Redend Point | `#EDEAE0 #E6DFD3 #D1C7B8 #95978A #C0B2A2 #AE8E7E #AC6B53 #7A8076 #434341` |
| Anew Gray | `#E2DED8 #D3CEC4 #C8CBC4 #A6B2B5 #BFB6AA #95978A #92948D #908A83 #5D6F7F` |
| Iron Ore | `#EDECE6 #EDEAE0 #D1CBC1 #CDB592 #95978A #AA866E #7C8E87 #434341 #2F3D4C` |
| Naval | `#EDECE6 #F0ECE2 #E5DFD2 #CDD2CA #D1CBC1 #ADBBB2 #A6B2B5 #98A9B7 #2F3D4C` |
| French Country | `#EDEAE0 #DFD3C3 #ACAD97 #C2DAE0 #D1C6D2 #EBD1CF #817A6E #9BBFC9 #78736E` |
| Coastal Farmhouse | `#EDEAE0 #E6DFD3 #DCD8D0 #DFD3C3 #CDD2D2 #BCCBCE #CDD2CA #98A9B7 #2F3D4C` |
| Beach House | `#F2EFE8 #EEE8DD #E4D7C4 #F2E4DE #D6DBD4 #ABBFB4 #A6B2B5 #98A9B7 #465667` |
| Cottagecore | `#EDEAE0 #E6DFD3 #D1C7B8 #CBB8C0 #BFC9D0 #DECABD #CDD2CA #7B8070 #708D9E` |
| Cozy Neutral | `#EDEAE0 #F5F2E8 #DFD3C3 #BFC9D0 #EADCD2 #ACAD97 #7B8070 #9E8F7C #78736E` |
| Bohemian | `#F0ECE2 #DFD3C3 #CDB592 #BFC9D0 #CDD2CA #DECABD #AC6B53 #7B8070 #54504A` |
| Mid-Century | `#EDEAE0 #D6CEC3 #CBA576 #A0AEAF #AE8E7E #AC6B53 #596E79 #7B8070 #54504A` |

Palettes belong to one of three brand categories: **Sherwin Williams**, **Behr**, **Benjamin Moore**. The catalogue filter is built on these; only Sherwin Williams has published palettes so far. A database import is expected — model palettes as data, not markup.

### Typography

Google Fonts: `Cormorant Garamond` (ital 300–600) and `Manrope` (300–600).

| Role | Family | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Page H1 (hero) | Cormorant Garamond | `clamp(42px, min(6.6vw,12vh), 130px)` | 500 | 1.02 | -0.015em |
| Page H1 (interior pages) | Cormorant Garamond | `clamp(40px, 6.6vw, 118px)` | 500 | 0.95 | -0.015em |
| Section H2 | Cormorant Garamond | `clamp(32px, 4.6vw, 86px)` | 500 | 0.96–0.99 | -0.01em |
| Card / panel H3 | Cormorant Garamond | `clamp(20px, 2.6vw, 48px)` | 500 | 1–1.05 | — |
| Pull quote | Cormorant Garamond | `clamp(26px, 3.4vw, 58px)` | 400 | 1.18 | — |
| Stat number | Cormorant Garamond | `clamp(46px, 5.2vw, 86px)` | 500 | 1 | — |
| Lede | Manrope | `clamp(15px, 1.15vw, 18px)` | 300–400 | 1.7 | — |
| Body | Manrope | `13–16.5px` | 400 | 1.65–1.85 | — |
| Eyebrow / label | Manrope | `10–11px` | 500 | — | 0.24–0.3em, uppercase |
| Button | Manrope | `12px` | 500 | — | 0.16em, uppercase |
| Nav link | Manrope | `13px` | 400 | — | 0.1em |

**Rule:** every serif heading ends with an emphasised italic phrase — `<em>` in Cormorant italic, weight 400. E.g. "Colors that make a house *feel like home.*", "A palette for *every feeling.*", "Questions, answered *plainly.*" Preserve this device.

Measure limits: headlines 14–24ch, body 40–62ch, quotes 30ch.

### Spacing & layout

- Page gutter: `clamp(18px, 3.4vw, 54px)`
- Section vertical padding: `clamp(56px, 9–12vh, 150px)`
- Grid gaps: `clamp(14px, 2vw, 30px)` cards; `clamp(26px, 5vw, 80px)` two-column editorial
- Breakpoint: single `900px` (JS-driven, see State Management); footer adds a `1180px` step
- Max content width: unbounded (full-bleed editorial); prose columns capped by `ch`

### Radius, shadow, motion

- **Radius:** `0` for panels, cards, images and swatches (deliberately square/editorial). `999px` only on buttons and pills. `50%` on icon buttons and decorative spheres.
- **Shadows:** card hover `0 26px 48px rgba(41,40,37,.13)`; button `0 18px 34px rgba(41,40,37,.16)`; on dark `0 22px 44px rgba(0,0,0,.34)`; slide-over panel `-30px 0 80px rgba(41,40,37,.28)`.
- **Easing:** `cubic-bezier(.22,1,.36,1)` for movement/reveal; `ease` for opacity/color; `cubic-bezier(.4,0,.2,1)` for color crossfades.
- **Durations:** micro 250–350ms; hover 450–600ms; image crossfade 550–800ms; slide-over 700ms; reveal 800–900ms; counters 1800ms.
- **Grain overlay:** inline SVG `feTurbulence` `baseFrequency 0.9`, 3 octaves, opacity ~0.2–0.3, `mix-blend-mode: overlay` (dark) / `multiply` (light).

---

## Screens / Views

### 1. Homepage — `Dwelling Dream Homepage v2.dc.html`

Order of sections:

**Nav (fixed, `z-index 80`)**
Logo image (`assets/logo-mark-light.png` over hero, crossfading to `assets/logo-mark.png` when solid) at `clamp(38px,4.4vw,54px)` tall; links Home · Styles · Palettes · About · Blog; pill CTA "Explore Palettes" → Palettes page; cart button with outlined-bag glyph + count.
Behavior: transparent + cream text over the hero; past `0.72 × viewport height` it transitions (500ms) to `rgba(245,242,234,.9)` + `blur(14px)` + `1px #D8D2C8` bottom border + ink text, and padding tightens 22px → 14px. The header element is `pointer-events: none` with its children `auto`, so the hero image beneath stays interactive.
A 2px `#817A6E` scroll-progress bar sits above it at `z-index 90`, `transform: scaleX()` from 0→1.

**Hero** — `min-height: 100vh`, dark base.
Full-bleed image slot at `inset: 0`, scaling `1 → 1.05` on scroll (origin `50% 30%`). Over it: a radial darkening (`120% 80% at 50% 48%`, `.62 → .2`) plus a vertical gradient, then grain.
Content is a centered column: eyebrow "Beautifully curated colors for beautiful spaces" → H1 "Colors that make a house *feel like home.*" (22ch, `text-wrap: balance`, `text-shadow: 0 4px 26px rgba(41,40,37,.5), 0 1px 3px rgba(41,40,37,.4)`) → 54ch lede → two CTAs (cream solid "Explore Palettes", cream-outline "Find Your Style") → centered "Scroll to explore ↓" with a 2.4s bob.
Copy layer is `pointer-events: none` except the CTA row. Copy translates up to −40px and fades to 0.3 opacity across the first viewport; a horizontal cursor lean of ±6px applies via `margin-left`.

**Featured this season** (`#featured`, bg-alt) — "Our three *best sellers.*" + "See all palettes →". Three cards (`auto-fit, minmax(260px,1fr)`): 4:3 image, brand-less title, one-line description, "9 colors" meta. Hover: card `translateY(-8px)` + shadow, image `scale(1.04)` over 800ms. Currently Mid-Century, Sea Salt, Cottagecore.

**Color inspiration for real spaces** (`#inspiration`) — asymmetric 12-column editorial grid. Six photo panels with spans 7/5, 5/7, 6/6 and staggered `margin-top` offsets, heights `clamp(360px, 56–62vh, 640px)`. Each panel: full-bleed photo, bottom-up scrim `rgba(41,40,37,.72) → transparent at 70%`, and overlaid content — "Palette 0N" eyebrow, serif name, ≤40ch description, a 9-color strip (`<ul>` of `flex:1` `<li>` with `title` attributes carrying hex + name, 26px tall, 3px gaps), and an "Explore palette →" underlined button that jumps to the matching style in section 3. Hover scales the media `1.05`. Collapses to one column below 900px. Ends with a centered "Explore All Palettes" pill.

**Which style feels like you?** (`#styles`, bg-alt) — the signature interaction. Two columns `1.05fr / 1fr`.
*Left:* seven hairline-separated rows, `01`–`07`: French Country, Coastal Farmhouse, Beach House, Cottagecore, Cozy Neutral, Bohemian, Mid-Century. Inactive rows are `#9B958D`; the active row goes ink, slides `translateX(14px)`, gains a `rgba(245,242,234,.6)` plate and 14px left padding, its rule scales `scaleX(0→1)`, and its body (italic descriptor + 9 swatches) expands `max-height 0 → 160px`; the swatches spring up individually `scaleY(.15) → 1` with a 45ms stagger.
*Right:* a stack of seven absolutely-positioned images. The active one is `opacity 1, scale(1), blur(0), clip-path inset(0)`; inactive are `opacity 0, scale(1.04), blur(10px), saturate(.85)` with a **direction-aware** clip (`inset(14% 0 0 0)` when moving down the list, `inset(0 0 14% 0)` when moving up). Transition: opacity 550ms, transform 800ms, clip-path 750ms. The frame tilts with the cursor — `perspective(1200px) rotateY(±3deg) rotateX(∓2.4deg) scale(1.01)`, 250ms in, 800ms spring back. A glass label bottom-left names the active style.
Hover drives selection on `hover: hover` devices; click/focus everywhere (mobile taps). A pill cursor-follower reading "View style →" tracks the pointer across the list. Ends with a centered "Explore All Styles" pill.

**What you will receive** (inside `#loved`) — "Three guides. *One confident decision.*" + "Instant download · No physical product". Three cards, each: full-bleed 3:2 preview image, `01/02/03` + page count row, serif title, summary, hairline-ruled feature list. Hover lifts `-8px`, background `#EDEAE0 → #F5F2EA`, shadow. Followed by a centered "Explore Palettes" pill.

**About the owner** (`#about`) — two columns `0.9fr / 1.1fr`: 4:5 portrait with ±18px scroll parallax and a caption, beside eyebrow, "Color should feel *effortless.*", two paragraphs, an italic signature, and three figures (10 yrs / 100+ / 1,000+) above a hairline.

**Beautiful colors. Loved by thousands.** — four stats counting up on 40% intersection over 1800ms with cubic ease-out: `0→1,000+`, `0→100+`, `0→9`, `4.0→4.9/5` (formatted `toLocaleString` + `+`, or `toFixed(1)+"/5"`). Below, centered testimonials: "What people say about us" eyebrow, a `clamp(100px,11vw,180px)` Cormorant open-quote glyph in `#DFD3C3` in normal flow, the quote at 30ch, then `Verified Customer` / `01 / 04` / ← → circular buttons. Switching fades out (260ms) then swaps text and fades in.

**Say goodbye to color confusion** (`#clarity`, bg-alt) — a before/after comparison. Two stacked photos; the "before" is clipped by a `width: N%` wrapper whose inner layer is pinned to the panel's pixel width so the image is *revealed*, not squeezed. A 2px cream divider with a 56px circular ↔ knob; drag anywhere on the panel (3px threshold so clicks still pass through to images), pointer tracking continues outside the panel, and a visually-hidden `range` input at the bottom provides keyboard control. On first intersection it animates 88% → 50% over 1500ms. The curated 9-color strip in the bottom-right fades in as the reveal passes 20–60%. Three supporting blurbs below.

**Your perfect palette is waiting** — full-bleed photo section `clamp(560px,96vh,900px)` with a top-to-bottom scrim, two floating decorative spheres/chips with cursor parallax, centered eyebrow/H2/lede/cream CTA. Image scales `1.04 → 1.09` and drifts 6% on scroll.

**Footer** — four columns (`1.4fr 1fr 1fr 1fr` → `1fr 1fr` under 1180px → `1fr` under 900px): brand blurb + centered logo + social pills (Pinterest, Instagram, Etsy, TikTok); Shop; Studio; Help & Legal (linked to the Help page anchors). Bottom bar: copyright · "Digital downloads · No physical product shipped" · "Back to top ↑".

### 2. Palettes — `Dwelling Dream Palettes.dc.html`

H1 "Every palette, *in one place.*" + lede "Every palette brings nine colors that already belong together — hex codes, real rooms they live in, two tested pairings for each shade, and the guidance to place them with confidence."

Sticky brand filter (`top: clamp(78px,10vh,96px)`, with a `#F5F2EA → transparent` gradient mask): **All · Sherwin Williams · Behr · Benjamin Moore**. Active pill is ink-filled. A live count reads "N palette(s) · N×9 colors"; an empty state reads "No palettes from this brand yet."

Grid `auto-fill, minmax(320px, 1fr)`. Each card: 4:3 image (zoom `1.03` on hover), brand eyebrow, serif name, description, "View" link. Card data lives on the article as `data-name`, `data-brand`, `data-tags`, `data-hexes` (comma-separated). "View" opens a right-side slide-over (`min(540px,100%)`, 700ms) listing all nine colors as full-width rows in their own color, with automatic light/dark text (luminance `0.299/0.587/0.114 < 150`) and click-to-copy that flips the label to "Copied" for 1.4s. Esc, scrim click and the ✕ close it; focus moves to the close button on open and returns on close.

Closing CTA on ink: "Take one palette and *start painting.*"

### 3. Product — `Dwelling Dream Product.dc.html`

Breadcrumb Home / Palettes / Sea Salt.

Two columns `1.15fr / 1fr`:
*Left:* 4:3 main image with four stacked crossfading views (500ms) and a 4-up square thumbnail row (active = ink border, others `opacity .72`); click or focus switches.
*Right:* "Sherwin Williams" eyebrow, H1 "Sea Salt *Palette*", 46ch description, price row (`$24`, struck `$39`, "Launch price" chip), "4.9/5 · 1,000+ homes painted", "Add to cart — $24" (ink solid) + "Buy now" (outline), an aria-live confirmation line, and a five-item hairline list of what's included.

**What's included** — two columns `0.85fr / 1.15fr`: heading block beside a four-item accordion (Color Palette Guide 50+ pages, Complete Paint Guide 30+ pages, Paint Project Planner, Delivery & refunds). First item open by default; the `+` icon rotates 45° when expanded; body animates `max-height 0 ↔ 300px` + opacity, 550ms.

**Recommended** (bg-alt) — "Pairs beautifully *with these.*" Three cards (Naval, Anew Gray, Greek Villa) with 4:3 images, brand, name, one-liner, price; hover lift + image zoom. "All palettes →" link.

**CTA** — "Nine colors. *One afternoon.*" + add-to-cart.

### 4. About — `Dwelling Dream About.dc.html`

Hero grid `1.5fr / 0.85fr`: eyebrow, H1 "I started with forty paint chips and *no idea.*", lede in the founder's voice (Shahroz) — beside a 4:5 portrait with caption. Two decorative paint-splatter clusters (a large blob plus 6–10 satellite dots in palette colors) sit at `z-index 0` in the outer margins; content is `z-index 1`. Clusters float on an 9.5–13s loop and drift with the cursor at depths 1.2 / 2.

**The story** — sticky heading beside a 62ch column: a large serif opening line then three paragraphs and an italic "— Shahroz".

**Color philosophy** — "Four things I believe about *color.*" A 2×2 grid separated by 1px `#D8D2C8` gutters (background shows through). Each panel: number, a 34px color dot, a 20ch serif claim, 44ch body. Hover warms the panel to `#EDEAE0` and scales the dot to 1.6.

**Newsletter** (ink) — "One palette, once a *month.*" with an email field (translucent, cream border that brightens on focus) + "Join". Client-side `checkValidity()`; success message "Thank you — the next palette is on its way".

### 5. Help — `Dwelling Dream Help.dc.html`

H1 "Questions, answered *plainly.*" then a pill jump-nav: FAQ · How downloads work · Terms · Privacy · Refunds · Licensing.

Six alternating-background sections, each a sticky numbered heading (`0.8fr`) beside content (`1.2fr`):
1. **FAQ** — five accordion items (same accordion pattern as the PDP, `max-height 340px`).
2. **Downloads** — a serif lead line and a four-step numbered list on hairlines.
3. **Terms** — four paragraphs; includes a required independence disclaimer: not affiliated with or endorsed by any paint manufacturer, and palettes are guidance rather than a guaranteed outcome.
4. **Privacy** — a serif summary line ("your email, your order, nothing else") plus three paragraphs.
5. **Refunds** — sales final on instant downloads, with a 30-day fix-it commitment for broken files, failed links, double charges or wrong palettes.
6. **Licensing** — a two-panel "Yes, please" / "Please don't" grid, four bullets each.

CTA: "Still stuck? *Ask us.*" → `mailto:hello@dwellingdream.com`.

---

## Interactions & Behavior

Implement these as the design's behavioral contract:

- **Scroll progress** — 2px bar, `scaleX(scrollY / (scrollHeight - innerHeight))`, updated inside a single rAF-throttled scroll handler.
- **Nav transition** — threshold `0.72 × innerHeight` on the homepage, `40px` elsewhere; only apply DOM writes when the state actually flips.
- **Reveal on scroll** — `IntersectionObserver`, `rootMargin: '0px 0px -12% 0px'`, from `opacity 0 / translateY(18–22px)`, 800–900ms, staggered `(i % 4–6) × 60–80ms`, unobserved after firing. **Include a 4s failsafe timer that reveals everything** in case observers never fire.
- **Counters** — `threshold: 0.4`, 1800ms, `1 - (1-p)³`.
- **Cursor parallax** — elements carry a depth multiplier; target = `-(pointer − center) × 24 × depth`, lerped at `0.07` per frame; the rAF loop stops when movement falls below 0.1px. Applied via the `translate` property so it composes with `transform`-based animations.
- **Magnetic buttons** — `translate(dx × 12px, dy × 8px)` from pointer offset within the element, reset to none on leave.
- **Style explorer** — see section 3 above; direction-aware clip reveal is the signature detail.
- **Comparison slider** — drag anywhere with a 3px threshold, window-level pointer tracking, keyboard range fallback, one-time entrance animation.
- **Accordions** — single-open not enforced; each toggles independently; `aria-expanded` drives all visual state.
- **Slide-over** — must be `display: none` *and* `hidden` when closed (an invisible full-screen scrim otherwise swallows the first click on the page — this was a real bug). Manage focus in and out; close on Esc and scrim click.
- **Reduced motion** — `prefers-reduced-motion: reduce` disables all `animation`, skips cursor parallax, magnetic buttons, reveals, counter tweening (values snap to final), quote fade delay and the comparison intro.

## State Management

Per page, minimal and local:

| State | Where | Notes |
|---|---|---|
| `navSolid: boolean` | Homepage | Derived from scroll |
| `activePalette: 0–12` | Style explorer | Hover / focus / click; also targeted by "Explore palette →" |
| `quoteIndex: 0–3` | Testimonials | Wraps both directions |
| `comparePercent: 4–96` | Clarity section | Drag + keyboard |
| `brandFilter` | Palettes | `all \| sherwin \| behr \| benjamin` |
| `openPalette` | Palettes | Slide-over target, or null |
| `galleryIndex: 0–3` | Product | Thumbnail selection |
| `openAccordion` | Product, Help | Per item |
| `cartCount` | Global | Stub — replace with real cart state |
| `isNarrow` | All | `window.innerWidth < 900`, resize-driven |

`isNarrow` exists only because inline styles couldn't express media queries. **In production use CSS media queries / Tailwind breakpoints and delete this state entirely.**

Data fetching: palettes should come from a database (name, brand, nine hex values with names and LRV, description, mood tags, image URLs, two pairings per color). The design currently hard-codes them; a data import is planned.

## Assets

**Logo** — `assets/logo-mark.png` (ink, transparent, 394×260) and `assets/logo-mark-light.png` (cream). Derived from a user-supplied original; both are alpha-masked so they tint cleanly. In production, request an SVG from the client and use `currentColor`.

**Photography — all placeholders.** Every image is an `<image-slot id="…" placeholder="…">`; replace each with a real optimized image. Briefs, by page:

*Homepage:* `dd2-hero` (warm neutral living room, natural light, linen + wood + ceramics, landscape 2400px+) · `dd2-panel-french|coastal|beach|cottage|neutral|boho` (six interiors matching Sea Salt, Greek Villa, Redend Point, Anew Gray, Iron Ore, Naval) · `dd2-style-french|coastal|beach|cottage|neutral|boho|midcentury` (seven portrait-ish interiors for the style explorer) · `dd2-feat-midcentury|seasalt|cottagecore` (three 4:3 best-seller rooms) · `dd2-bundle-palette|paint|planner` (three 3:2 PDF spreads) · `dd2-owner` (4:5 founder portrait) · `dd2-clarity-before|after` (same room, undecided vs painted) · `dd2-cta` (full-width closing interior).

*Palettes:* `ddp-sea-salt` (4:3 Sea Salt room).
*Product:* `ddx-sea-salt-1…4` (hero room, navy accent room, guide spread, detail shot) · `ddx-rec-naval|anew|greek`.
*About:* `dda-portrait-2` (4:5 founder portrait).

Photography direction: warm, natural light, architectural, editorial, realistic materials. No people prominent, no obvious stock styling, no text or watermarks.

**Icons** — the only iconography is a CSS-drawn shopping bag, text arrows (← → ↑ ↓ ✕ ⇄ +) and the `↔` knob. Swap for the codebase's icon set if one exists.

## Accessibility notes worth preserving

- One `<h1>` per page; logical `h2`/`h3` order; every section labelled via `aria-labelledby`.
- Style list and filters use `role="tablist"` / `role="tab"` + `aria-selected`; keyboard focus selects.
- All swatches expose `aria-label` with hex + palette name — color is never the sole carrier of information.
- Live regions on the testimonial index, cart count, hex tooltip, newsletter and add-to-cart confirmations.
- Focus ring: `2px solid #817A6E`, `outline-offset: 3px`.
- Never hide palette names or descriptions inside canvas/WebGL — they're crawlable text by design.

## Files

Design references included in this bundle:

- `Dwelling Dream Homepage v2.dc.html`
- `Dwelling Dream Palettes.dc.html`
- `Dwelling Dream Product.dc.html`
- `Dwelling Dream About.dc.html`
- `Dwelling Dream Help.dc.html`
- `assets/logo-mark.png`, `assets/logo-mark-light.png`
- `interactions.js` — portable implementation of all interactions (production-usable)

Not included and not needed: `support.js` (proprietary runtime) and `image-slot.js` (the editor's drag-and-drop placeholder component — replace with real images).

## Suggested build order

1. Tokens, fonts, layout primitives, nav + footer shell.
2. Palette data model + Palettes page (proves the data shape).
3. Product page + cart/checkout integration.
4. Homepage — hero, then the style explorer (the hardest piece), then the rest.
5. About + Help (mostly static content).
6. Pass over reduced-motion, keyboard paths and real image optimization.
