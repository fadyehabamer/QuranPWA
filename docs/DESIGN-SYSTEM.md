# QuranPWA Design System

## Direction: warm paper, green as accent only

The canvas is warm paper (`#FBF8F2`), text is warm ink (`#1A1714`), and **green
appears only on actions, active state and thin accent marks** — never as a large
surface. The app previously painted green across roughly a third of every
screen, which is why each page read as the same green block regardless of its
content.

Three rules this system enforces:

1. **Accent is small.** If green covers more than a few percent of a screen,
   something is wrong. No green heroes, no green headers, no green panels.
2. **Depth from hierarchy, not decoration.** Flat surfaces, hairline borders,
   type weight. No gradients on surfaces, no glow, no blur stacks.
3. **Content leads.** Screens open on what the user came for, not on a title
   card describing the app.

UI type is **IBM Plex Sans Arabic** (Cairo is the fallback); scripture stays
**Amiri**. The type scale uses large jumps so headings and body are clearly
distinct — the previous ramp moved 1–2px per step and read as one size.

Load order (every page): `css/tokens.css` → `css/styles.css` →
`css/components.css` → `css/page-styles/<page>.css` → `css/app-ui.css`

`css/app-ui.css` loads **last** and owns the shared visual language (surfaces,
rows, icon tiles, buttons). Page CSS that disagrees with it loses. `tokens.css`
is the only place `:root` may be declared — `styles.css` used to redeclare it
with an older palette and, loading later, silently overrode the token layer.

`js/a11y.js` loads in `<head>` as a blocking script so `window.A11y` exists before `common.js`.

---

## Tokens (`css/tokens.css`)

Never hardcode a value that has a token.

| Group | Tokens |
|---|---|
| Spacing | `--space-1`(4px) `-2`(8) `-3`(12) `-4`(16) `-5`(20) `-6`(24) `-8`(32) `-10`(40) `-12`(48) `-16`(64) |
| Type | `--text-2xs` `-xs` `-sm` `-base` `-md` `-lg` `-xl` `-2xl` `-3xl` `-4xl` (lg and up are fluid `clamp()`) |
| Leading | `--leading-tight` `-snug` `-normal` `-relaxed` `-quran`(2.1) |
| Weight | `--weight-normal` `-medium` `-semibold` `-bold` |
| Radius | `--radius-xs`(6) `-sm`(10) `-md`(14) `-lg`(20) `-xl`(28) `-full` |
| Elevation | `--elev-1` … `--elev-5`, `--elev-primary` |
| Colour | `--primary-color` `--primary-light` `--primary-dark` `--on-primary` `--secondary-color` `--accent-color` |
| Surface | `--bg-color` `--bg-subtle` `--surface-1` `--surface-2` `--surface-3` |
| Text | `--text-color` `--text-secondary` `--text-muted` |
| Border | `--border-color` `--border-strong` |
| Status | `--success` `--warning` `--danger` `--info` (+ matching `--*-surface`) |
| Z-index | `--z-below` `-base` `-raised` `-sticky` `-header` `-nav` `-overlay` `-drawer` `-modal` `-popover` `-toast` |
| Motion | `--duration-fast/normal/slow`, `--ease-out/-in-out/-spring`, `--transition-fast/normal/slow` |
| Layout | `--container` `--container-narrow` `--header-height` `--bottom-nav-height` `--tap-target`(44px) `--measure` |
| Safe area | `--safe-top` `--safe-bottom` `--safe-inline-start` `--safe-inline-end` |

### Rules

1. **`--on-primary` for text on primary surfaces.** Never bare `color: #fff` — it cannot follow the theme.
2. **Elevation is a complete shadow.** Write `box-shadow: var(--elev-3)`, never `box-shadow: 0 4px 12px var(--elev-3)`. The latter produces six length values, which is invalid CSS and is silently discarded — this was an existing bug at 31 sites.
3. **Z-index only from the scale.** Use `calc(var(--z-nav) + 10)` for a local sub-layer.
4. **Motion respects `prefers-reduced-motion`** — handled globally in `tokens.css`; do not re-add long durations inline.

---

## RTL

This app is `dir="rtl"`. Use **logical properties** so the layout is expressed once:

| Use | Not |
|---|---|
| `padding-inline-start` | `padding-right` |
| `margin-inline-end` | `margin-left` |
| `inset-inline-start` | `left` |
| `text-align: start` | `text-align: right` |
| `border-inline-start` | `border-right` |

Never encode direction in a class name (`.floating-nav-left`) — it cannot be flipped.

---

## Components (`css/components.css`)

### Card
```html
<div class="card">…</div>
<div class="card card--glass card--padded">…</div>
<button class="card card--interactive">…</button>
```
Modifiers: `--glass` `--flat` `--padded` `--compact` `--interactive`.
Interactive cards must be a `<button>` or `<a>`, never a `<div onclick>`.

### Button
```html
<button class="btn btn--primary">حفظ</button>
<button class="btn btn--icon" aria-label="إغلاق"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
```
Variants: `--primary` `--secondary` `--ghost` `--danger`. Sizes: `--sm` `--lg` `--block` `--icon`.
Async: set `data-loading="true"` to show a spinner and block input without resizing.

All buttons are ≥44px tall. **Icon-only buttons require `aria-label`** — an icon-font glyph is `::before` content with no text node, so without one the control announces as just "button".

### Form
```html
<div class="field">
  <label class="field-label" for="x">العنوان</label>
  <input id="x" class="input">
  <p class="field-hint">تلميح</p>
</div>
```
`.input` `.select` `.textarea` `.search-field`. Font size is 16px minimum so iOS does not zoom on focus.

### Switch
Replaces `<div class="toggle-switch">`, which had no role, no keyboard path and no name:
```html
<button class="switch" role="switch" aria-checked="false" aria-label="الوضع الليلي"></button>
```

### Other
`.skip-link` `.sr-only` `.empty-state` `.skeleton` `.dialog-backdrop` `.dialog-panel`
Utilities: `.stack` `.row` `.row-between` `.container` `.measure` `.scroll-x`

---

## `window.A11y` (`js/a11y.js`)

```js
A11y.openDialog(overlayEl, { panel, initialFocus, onClose, closeOnEscape });
A11y.closeDialog(overlayEl);
A11y.isDialogOpen(overlayEl);
A11y.makeActivatable(el, handler);   // keyboard support for legacy div-buttons
A11y.announce(message, assertive);   // live-region announcement
```

`openDialog` traps focus, locks scroll, inerts the background, closes on Escape and restores focus to the trigger on close.

---

## Accessibility checklist

- [ ] Icon-only control has `aria-label`; its `<i>` has `aria-hidden="true"`
- [ ] Clickable element is a `<button>`/`<a>`, not a `<div onclick>`
- [ ] Every input has a `<label for>` or `aria-label` — placeholder is not a label
- [ ] One `<h1>` per page; no skipped levels
- [ ] `<main>`, labelled `<nav>`, banner present
- [ ] Dialog uses `A11y.openDialog`
- [ ] Focus visible everywhere; no bare `outline: none`
- [ ] Contrast ≥ 4.5:1 in **both** themes
- [ ] Touch targets ≥ 44px
- [ ] Verified at 375 / 768 / 1024 / 1440px, light and dark
