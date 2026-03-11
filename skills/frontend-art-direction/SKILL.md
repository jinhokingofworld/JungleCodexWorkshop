---
name: frontend-art-direction
description: Use when the user wants a frontend that feels less generic, less childish, or more intentional. Helps redesign landing pages and product surfaces with stronger art direction, better typography, clearer visual hierarchy, restrained motion, and concrete anti-boilerplate rules.
---

# Frontend Art Direction

Use this skill when the user says the UI feels too generic, too safe, too template-like, too childish, or "AI-ish".

This skill is for visual direction before code generation as much as for implementation. Prefer changing the page's point of view, rhythm, and typography before adding more sections or decorative effects.

## Default stance

- Do not ship another soft-blue SaaS page with rounded cards everywhere, equal-weight sections, and a hero followed by three interchangeable grids.
- Do not solve weak art direction with more gradients, more badges, or more microcopy.
- Do not use motion as decoration. Motion should reveal hierarchy, state changes, or reading order.
- Do not mix three visual ideas. Pick one direction and commit.

## Fast diagnosis

If the current page has most of these traits, treat it as visually weak:

- Hero, card grid, card grid, logo-strip rhythm.
- One type family doing every job.
- Same radius, same shadow, same border treatment on every surface.
- Accent color applied uniformly instead of strategically.
- No strong focal plane on first viewport.
- Mobile is only "stacked desktop".
- Sections can be reordered without changing the story.

## Repo-specific read

For this project, the current homepage already shows several generic patterns:

- Repeated `panel` and `card-grid` sections flatten hierarchy.
- The visual language leans on safe fintech blue plus soft glass panels.
- Typography is competent but not opinionated; display and body voices are too similar.
- The hero explains the product but does not create a memorable first-frame.

Treat those as constraints to break, not styling to preserve, unless the user asks for incremental refinement only.

## Workflow

1. Audit the existing page and name the current failure mode in one sentence.
2. Choose one art direction that fits the product and market.
3. Define the system before writing code: display font, body font, palette, spacing scale, radius strategy, border strategy, motion rule.
4. Restructure the page so section order tells a story rather than listing features.
5. Use one standout device in the first viewport: oversized type, asymmetrical composition, live data board, editorial lead, or product proof.
6. Re-check mobile, reduced motion, and readability before polishing.

## Recommended directions

For finance, markets, AI analysis, or research-heavy products, prefer one of these:

### 1. Editorial Briefing

- Mood: financial newspaper, premium research letter, calm authority.
- Use a high-character display serif with a restrained sans for UI.
- Let headlines do the differentiation instead of colored boxes.
- Build long reading rails, annotated stats, dividers, and issue-style modules.
- Use warm neutrals or paper tones instead of default app blue.

Good fit when the product's value is judgment, explanation, and trust.

### 2. Institutional Terminal

- Mood: data desk, control room, conviction, live signal.
- Use a condensed grotesk or mono accent with a plain readable sans.
- Favor sharp edges, grid logic, dense but controlled information blocks.
- Let one data board dominate the hero instead of a marketing illustration.
- Motion should feel like system updates, not floating cards.

Good fit when the product's value is speed, tracking, and market awareness.

### 3. Premium Intelligence

- Mood: strategy memo, executive dashboard, quiet exclusivity.
- Use a refined serif or contrast display paired with disciplined sans UI text.
- Reduce visible UI chrome; increase whitespace and typographic contrast.
- Replace crowded multi-card sections with fewer, stronger modules.
- Use one deep accent color and one metallic or warm supporting tone.

Good fit when the product is selling synthesis, not raw quantity.

## Composition rules

- One section must dominate each viewport. Stop giving every block equal visual weight.
- Use alternating density: dense data block, quiet text block, visual proof block.
- Prefer asymmetry with alignment discipline over perfectly centered sameness.
- Limit line length for body copy. A readable target is roughly 45 to 75 characters.
- If everything is inside a card, remove cards until hierarchy becomes obvious.
- If cards remain, vary at least one of scale, border, radius, background, or layout role.

## Typography rules

- Separate display voice from reading voice.
- Headlines should create mood before copy is read.
- Use `clamp()` for fluid type and spacing instead of hard breakpoint jumps.
- Avoid long hero paragraphs. Tighten claim, then support it with one proof mechanism.
- For Korean plus English interfaces, test rhythm carefully; a type pairing that looks good in English alone often collapses in mixed text.

## Color and surface rules

- Build around 3 to 5 core tokens, not a rainbow.
- Background should carry some atmosphere: grain, gradient field, paper warmth, chart-grid texture, or tonal depth.
- Use accent color sparingly on actions, key numbers, and one signature element.
- Shadows should express depth hierarchy, not appear on every component.
- Radius is a brand decision. Big radius everywhere reads soft and generic.

## Motion rules

- Reveal by opacity and transform first. Avoid layout-triggering animation.
- Use motion to stage information: hero load, chart emphasis, section handoff, hover intent.
- Keep easing natural and quick; avoid syrupy transitions.
- Respect `prefers-reduced-motion` and provide a calmer variant.

## Anti-boilerplate rules

- Do not open with eyebrow, giant headline, subcopy, two CTA pills, then a right-side card unless there is a strong reason.
- Do not repeat the same container style for hero, stats, testimonials, and lists.
- Do not add fake complexity with badges, floating avatars, or decorative charts that carry no information.
- Do not rely on one stock illustration or one dashboard screenshot to create identity.

## Output format when applying this skill

When proposing or implementing a redesign, provide:

- A one-line diagnosis of what feels generic.
- The chosen direction name.
- A short visual system definition.
- A section-by-section restructuring plan.
- Specific notes on typography, color, and motion.
- Any accessibility or performance constraints that shape the design.

## Source-backed reminders

These references informed the rules above:

- `web.dev` on typography: https://web.dev/learn/design/typography/
- `web.dev` on `min()`, `max()`, `clamp()`: https://web.dev/articles/min-max-clamp
- `web.dev` on CSS and Web Vitals animation guidance: https://web.dev/articles/css-web-vitals
- `web.dev` on reduced motion: https://web.dev/articles/prefers-reduced-motion
- `web.dev` layout pattern on readable clamped cards: https://web.dev/patterns/layout/clamping-card/
- `Smashing Magazine` on line length and font size in responsive design: https://www.smashingmagazine.com/2014/09/balancing-line-length-font-size-responsive-web-design/
- `Awwwards` write-up on CANALS for multi-typeface editorial art direction and restrained motion: https://www.awwwards.com/canals-wins-site-of-the-month-december.html
- `Orizon` roundup highlighting bold typography and live product proof as high-impact landing patterns: https://www.orizon.co/fr/blog/summer-our-10-favourite-landing-page-designs-in-summer-2025-and-why-they-convert

## Success criteria

- The first screen is recognizable from memory after one visit.
- The page story has a clear order and cannot be shuffled arbitrarily.
- Typography carries brand personality instead of decoration doing all the work.
- Motion improves comprehension without hurting performance or accessibility.
- The page still feels deliberate on mobile, not merely collapsed.
