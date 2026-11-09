---
inclusion: always
---

# Séance UI steering: design system

Follow this file for every UI change. The visual source of truth is `design/mocks/*.html`; match those mocks. Deeper rationale lives in `design/design.md`.

## ⚠ Revision v2 (9 Nov 2026, Douglas's review): the landing is now playful
Douglas asked for a landing "like" a Halloween-decor Dribbble reference, **with the webs**. That **reverses the "no cobwebs / not cheesy" rule for the landing page only**:
- **Landing (`/`):** playful spooky style. A charcoal card floats on a burnt-orange backdrop, original line-art cobwebs sit in the corners, the display font is Jolly Lodger, a pumpkin-red accent word is allowed, a 3D hero object glows, round pumpkin CTA icons, prop tiles and outline chips.
- **App (workspace, picker):** stays calm and readable as specified below. The only v2 touches are the wordmark in Jolly Lodger pumpkin and one small cobweb (34% opacity) in the top-bar corner. **Never** put webs, the spooky font or pumpkin accents inside code, narration or output panes.
- Still banned everywhere: skulls, gore, dripping fonts (Creepster, Nosifer), the word "Ouija", and third-party art or logos.

## Principles
1. **Restrained and cinematic in the app; playful on the landing (v2).** The mood comes from light, timing and type. Never use clip art.
2. **Readable first.** Every text color passes WCAG AA on its surface. Body text is 14px.
3. **One flow:** task → dead-language code → ghost explanation → Python + output. The current step is always shown in all panes at once (linked highlighting).
4. **Motion uses opacity and transform only**, always behind `prefers-reduced-motion`.
5. **Use tokens only.** No raw hex, px font sizes or durations in components; use the variables below.

## Design tokens

### Color
| Token | Hex | Role |
|---|---|---|
| `--void` | #0A090C | App background |
| `--crypt` | #121015 | Pane and card surface |
| `--altar` | #1A171E | Raised: inputs, active narration, menus |
| `--terminal` | #0D110E | CRT surface for dead-language code and run output |
| `--seam` | #2B2631 | Hairline borders |
| `--seam-strong` | #3D3645 | Hover borders, input borders |
| `--bone` | #EDE6D8 | Primary text |
| `--ash` | #B3A999 | Secondary text |
| `--dust` | #8E8578 | Footnotes, line numbers, placeholders (darkest allowed text) |
| `--candle` | #E9A957 | Primary action, active line, focus ring, italic title emphasis |
| `--candle-deep` | #B9772F | Pressed primary |
| `--candle-ink` | #1A1006 | Text on candle |
| `--candle-veil` | rgba(233,169,87,.10) | Active code-line background |
| `--phosphor` | #9FDDB0 | Dead-language code text, success |
| `--phosphor-dim` | #74A983 | Code comments |
| `--ecto` | #C7C0E6 | Ghost voice accents: epithets, PIC clauses, caret |
| `--danger` | #EE8E7E | Errors |

Syntax colors: dead-language keywords `#D4F5DC`, literals `--candle`, PIC clauses `--ecto`, comments `--phosphor-dim` italic. Python keywords `--candle`, strings `--phosphor`, calls `--ecto`, comments `--dust` italic, names `--bone`.

### Type
| Token | Value | Use |
|---|---|---|
| `--font-display` | Instrument Serif | App titles, pane titles, ghost quotes, language names (italic) |
| `--font-spooky` | Jolly Lodger | Landing display + wordmark only (v2) |
| `--font-body` | DM Sans 400/500/600 | All UI and body text |
| `--font-code` | IBM Plex Mono 400/500 | Code panes, file chips |
| `--font-crt` | VT323 | Run output, LINES x–y refs, year badges only |
| `--text-xs/sm/base/md/lg/xl/2xl/hero` | 12/13/14/16/20/28/40/56px | 14 = body; 28 = page title; 56 = landing hero only |
| Code | 13px / 19px line (12px on <768) | |
| Pane title | display italic 19px | |
| Ghost quote | display italic 18px / 1.3 | |

Headline pattern: plain clause in bone + second clause in `<em>` italic serif candle. Example: `Three steps, <em>one very old friend.</em>`

### Spacing, radii, elevation
- Spacing (4px base): `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 · `--s-10` 40 · `--s-14` 56 · `--s-20` 80. Pane gap is 12px; app gutter is 24px desktop and 16px mobile.
- Radii: `--r-xs` 4 (kbd, tags) · `--r-sm` 8 (buttons, inputs, narration rows) · `--r-md` 12 (panes, cards) · `--r-lg` 20 (dialogs, hero preview) · `--r-pill` 999.
- `--shadow-pane`, `--shadow-pop` (dialogs), `--glow-candle` (selected or focused primary surfaces), `--glow-phosphor` (text-shadow on CRT text), `--ring` (focus).

### Motion
| Token | Value | Use |
|---|---|---|
| `--d-instant` | 80ms | Press |
| `--d-fast` | 160ms | Hover, color, veil |
| `--d-base` | 240ms | Line enter, card lift, scrim |
| `--d-slow` | 420ms | Flicker-in, rise-in, dialog |
| `--d-glide` | 600ms | Planchette glide |
| `--d-breathe` | 4800ms | Candle glow loop |
| `--stagger-line` | 40ms | Code streaming stagger |
| `--ease-out` | cubic-bezier(.2,.7,.2,1) | Default |
| `--ease-glide` | cubic-bezier(.65,0,.35,1) | Planchette |
| `--ease-in` | cubic-bezier(.5,0,.75,0) | Exits |

Keyframes (copy as-is): `breathe` (opacity .35↔.85), `flickerIn` (0 → .75 → .5 → 1, run once), `riseIn` (opacity + translateY 6px), `lineIn` (opacity + translateX −4px), `caret` (steps, 1.06s).

### CSS custom properties (paste into `src/styles/tokens.css`)
```css
/* Séance design tokens: source of truth (mirrored in seance-steering.md) */
:root{
  /* surfaces */
  --void:#0A090C;        /* app background */
  --crypt:#121015;       /* panes, cards */
  --altar:#1A171E;       /* raised: inputs, menus, active rows */
  --terminal:#0D110E;    /* CRT code + run output background */
  --seam:#2B2631;        /* hairline borders */
  --seam-strong:#3D3645; /* hover borders, dividers on raised */
  /* text */
  --bone:#EDE6D8;        /* primary text, 15.2:1 on crypt */
  --ash:#B3A999;         /* secondary text, 8.1:1 */
  --dust:#8E8578;        /* footnotes, line numbers, 5.2:1 */
  /* accents */
  --candle:#E9A957;      /* primary action, active line, focus */
  --candle-deep:#B9772F; /* pressed */
  --candle-ink:#1A1006;  /* text on candle, 9.2:1 */
  --candle-veil:rgba(233,169,87,.10); /* active-line wash */
  --phosphor:#9FDDB0;    /* dead-language code text, success */
  --phosphor-dim:#74A983;/* code comments, sequence area */
  --ecto:#C7C0E6;        /* the ghost's voice: narration accents */
  --danger:#EE8E7E;      /* errors */
  /* type */
  --font-display:"Instrument Serif", "Iowan Old Style", Georgia, serif;
  --font-body:"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-code:"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --font-crt:"VT323", "IBM Plex Mono", monospace; /* run output + tiny labels only */
  --text-xs:12px; --text-sm:13px; --text-base:14px; --text-md:16px;
  --text-lg:20px; --text-xl:28px; --text-2xl:40px; --text-hero:56px;
  --leading-tight:1.1; --leading-snug:1.3; --leading-body:1.55; --leading-code:20px;
  /* spacing (4px base) */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
  --s-8:32px; --s-10:40px; --s-14:56px; --s-20:80px;
  /* radii */
  --r-xs:4px; --r-sm:8px; --r-md:12px; --r-lg:20px; --r-pill:999px;
  /* elevation + glow */
  --shadow-pane:inset 0 1px 0 rgba(255,255,255,.03), 0 24px 60px -28px rgba(0,0,0,.7);
  --shadow-pop:0 18px 50px -12px rgba(0,0,0,.75);
  --glow-candle:0 0 0 1px rgba(233,169,87,.40), 0 0 28px rgba(233,169,87,.18);
  --glow-phosphor:0 0 6px rgba(159,221,176,.35);  /* text-shadow on code */
  --ring:0 0 0 2px var(--void), 0 0 0 4px var(--candle);
  /* motion */
  --d-instant:80ms; --d-fast:160ms; --d-base:240ms; --d-slow:420ms;
  --d-glide:600ms; --d-breathe:4800ms; --stagger-line:40ms;
  --ease-out:cubic-bezier(.2,.7,.2,1);
  --ease-glide:cubic-bezier(.65,0,.35,1);
  --ease-in:cubic-bezier(.5,0,.75,0);
}
/* v2 landing additions (Douglas review, 9 Nov 2026): playful spooky landing */
:root{
  --font-spooky:"Jolly Lodger", "Instrument Serif", Georgia, serif; /* landing display + wordmark only */
  --pumpkin:#FF4A2E;      /* accent word, round CTA icon, wordmark. 4.6:1 on --charcoal */
  --pumpkin-deep:#D9361D; /* pressed */
  --pumpkin-glow:rgba(255,106,48,.45);
  --charcoal:#242428;     /* landing card surface */
  --charcoal-raised:#2E2E34; /* pills, tiles, chips hover */
  --charcoal-line:#45454D;   /* outline chips / pill borders */
  --card-text:#F6F1EA;    /* headline on charcoal */
  --card-body:#C9C4BC;    /* body on charcoal, 8.9:1 */
  --card-muted:#9A958E;   /* footnotes on charcoal, 5.2:1 */
  --web:#F4EADF;          /* cobweb strokes, used at .7 opacity */
  --backdrop:radial-gradient(120% 90% at 100% 0%,#D8622F 0%,#B24A26 28%,transparent 62%),radial-gradient(90% 80% at 0% 100%,#C25A2C 0%,#8E3E22 30%,transparent 65%),linear-gradient(160deg,#5E5752 0%,#6B4A3A 45%,#9C4524 100%);
  --vignette:radial-gradient(130% 100% at 50% 50%,transparent 55%,rgba(20,10,6,.55) 100%);
  --r-card:24px; --r-tile:22px;
  --d-sway:7000ms; --d-float:6000ms;
}
```

```css
/* motion primitives + reduced motion (paste into src/styles/motion.css) */
@keyframes breathe{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes flickerIn{0%{opacity:0}55%{opacity:.75}70%{opacity:.5}100%{opacity:1}}
@keyframes riseIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes lineIn{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:none}}
@keyframes caret{0%,49%{opacity:1}50%,100%{opacity:0}}
.crt{background:var(--terminal);position:relative}
.crt::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(to bottom,rgba(255,255,255,.018) 0 1px,transparent 1px 3px)}
:focus-visible{outline:none;box-shadow:var(--ring)}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;
    transition-duration:1ms!important;scroll-behavior:auto!important}
}
```

Fonts (in `index.html`):
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&family=VT323&family=Jolly+Lodger&display=swap" rel="stylesheet">
```

Optional Tailwind mapping (`tailwind.config.js` → `theme.extend`):
```js
colors:{void:'var(--void)',crypt:'var(--crypt)',altar:'var(--altar)',terminal:'var(--terminal)',seam:'var(--seam)',
  bone:'var(--bone)',ash:'var(--ash)',dust:'var(--dust)',candle:'var(--candle)',phosphor:'var(--phosphor)',ecto:'var(--ecto)',danger:'var(--danger)'},
fontFamily:{display:'var(--font-display)',body:'var(--font-body)',code:'var(--font-code)',crt:'var(--font-crt)'},
borderRadius:{xs:'4px',sm:'8px',md:'12px',lg:'20px'},
transitionTimingFunction:{out:'var(--ease-out)',glide:'var(--ease-glide)'}
```

## Landing v2 tokens and components
| Token | Value | Use |
|---|---|---|
| `--font-spooky` | **Jolly Lodger** (Google Fonts, OFL) | Landing H1 80px/0.98 (54px mobile), section H2 56px (42px mobile), card titles 30–40px, wordmark 27–34px. Never in app panes. |
| `--pumpkin` | #FF4A2E | One accent word per headline, round CTA dots, wordmark. 4.6:1 on charcoal. White icons on it only (3.35:1, non-text). |
| `--pumpkin-deep` | #D9361D | Pressed |
| `--pumpkin-glow` | rgba(255,106,48,.45) | Shadow under round buttons |
| `--charcoal` | #242428 | Landing card |
| `--charcoal-raised` | #2E2E34 | Pill CTA, step and spirit cards |
| `--charcoal-line` | #45454D | Outline chips |
| `--card-text` / `--card-body` / `--card-muted` | #F6F1EA / #C9C4BC / #9A958E | Text on charcoal (≥ 5.2:1) |
| `--web` | #F4EADF | Cobweb stroke, element opacity .72 |
| `--backdrop` | burnt-orange radial + linear gradient (see CSS) | `body::before` behind the card |
| `--vignette` | radial dark edge | `body::after` |
| `--r-card` / `--r-tile` | 24px / 22px | Card / tiles and cards |
| `--d-sway` / `--d-float` | 7000ms / 6000ms | Web sway / object float |

| Component | Props | Notes |
|---|---|---|
| **BackdropCard** | `children` | Page padding 40/48px; card radius 24, `--charcoal`, deep shadow, `overflow:hidden`. Mobile: full-bleed (padding 0, radius 0). |
| **Cobweb** | `corner: 'tr'\|'bl'\|'br'`, `size` | Original SVG `assets/cobweb.svg` (9 spokes, 8 sagging rings, 1.5px `vector-effect:non-scaling-stroke`, `--web` at .72). Mirror with `scaleX(-1)`/`scaleY(-1)` per corner. `aria-hidden`, `pointer-events:none`, z-index above the card. **Never over text**: tr 340px (nav buttons keep 220px clear), bl 280px at top 660px (over the prop tile corner only), br 220px at the footer (footer text keeps 240px clear). Mobile: 130px tr, bl hidden, br 110px. Animation: `sway` rotate 0→1.2° over 7s, origin at the corner. |
| **Spider** | – | 18px line-art spider on a 1px thread (150px, 64px mobile) under the tr web; `dangle` translateY 10px plus rotate 2° over 5.2s. |
| **HeroObject** | `src`, `alt` | `assets/hero-terminal-dark.jpg` (on a #1B1B1B background) with `mix-blend-mode:lighten` and a radial mask so it melts into the charcoal; `assets/hero-terminal.png` is the transparent cutout for other backgrounds. Behind it: a 560px pumpkin radial **Glow** (opacity `breathe` 4.8s). Object `float` translateY −8px over 6s. Mobile: 300px, placed **above** the headline. |
| **PillCTA** | `href`, `label` | 52px charcoal-raised pill with a 40px pumpkin circle holding a white planchette icon, label 14px/500. Paired with an underlined **TextLink** (offset 6px). |
| **RoundIconButton** | `variant: dark\|pumpkin` | 40px nav circles (search-style → "Inside a séance", planchette → workspace). |
| **PropTile** | `img`, `href`, `ariaLabel` | 240×170, radius 22, brown gradient (#4B3631→#2F2829). The prop PNG overflows the top edge with a drop shadow and floats −6px. Props: `assets/prop-hat-floppy.png`, `assets/prop-candle-cards.png`. No caption text (webs may overlap). |
| **FeatureChips** | `items[]` | 36px outline pills (`--charcoal-line`): COBOL · Fortran · BASIC · Line-by-line ghost · Back to Python · Real GnuCOBOL compiler. Desktop under the hero object; mobile under the CTAs. |

Reduced motion: sway, dangle, float and breathe all stop; objects rest at their neutral transform.

## Components

Plain React function components and CSS modules (or Tailwind). The names below are the file and component names.

| Component | Props | States / variants | Notes |
|---|---|---|---|
| **AppShell** | `children`, `tab?` | desktop 3-col · tablet 2-col + tabs · mobile 1 panel + tabs | Grid `1.3fr 1fr 1fr`, gap 12, gutter 24. Holds `activeStep` state shared by all panes. |
| **TopBar** | `sessionTitle`, `language`, `status`, `onEnd` | landing (nav + CTA) · app (title, LanguageTrigger, StatusPill, End séance) | 56px, bottom `--seam`, translucent void with backdrop blur. Mobile: mark + wordmark + LanguageTrigger only. |
| **Wordmark** | `size` | mark-only · mark + text | Inline SVG planchette (`design/logo-mark.svg`) plus "Séance" in **Jolly Lodger, `--pumpkin`**, 27px in the app and 34px on the landing (v2). The app top bar also carries one `TopBarWeb` (64px cobweb, 34% opacity, top-right corner, with 76px right padding so it never covers controls). |
| **TaskInput** | `value`, `file?`, `onChange`, `onSubmit`, `disabled` | empty (placeholder "Describe a task in plain English…") · filled · focused (candle border + `--glow-candle`) · disabled while summoning | 52px (46px mobile), `--altar`, radius 12. Leading candle arrow icon. FileChip inside, hidden on mobile. ⌘/Ctrl+Enter submits. |
| **FileChip** | `name`, `rows` | default · removable | Plex Mono 12px, e.g. `sales.csv · 4 rows`. |
| **SummonButton** | `state`, `onClick` | idle "Summon" · after a run "Summon again" · summoning (disabled, "Summoning…") · icon-only below 768 (↵, aria-label "Summon") | Primary candle. `::after` breathing glow. Shows a `⌘⏎` kbd hint. |
| **Button** | `variant`, `size` | `candle` · `outline` · `ghost`; `md` 36px · `lg` 44px | Radius 8, DM Sans 500 13/14px; `translateY(1px)` on press. |
| **StatusPill** | `status` | `present` (phosphor dot) "Spirit present" · `summoning` (candle) "Summoning" · `error` (danger, no breathing) "Didn't compile" / "Run failed" · `idle` "Candles lit" | 26px, `role="status"`. Dot halo breathes. |
| **LanguageTrigger** | `language`, `onOpen` | default · hover | "Spirit **COBOL** ▾", opens LanguagePicker. `aria-haspopup="dialog"`. |
| **LanguagePicker** | `open`, `value`, `dialect`, `onSelect`, `onClose` | dialog (desktop) · bottom sheet (<768) | `role="dialog" aria-modal`; title "Who should *answer?*"; grid of LanguageCard in `role="radiogroup"` with arrow-key roving; footer Cancel + "Summon with {lang}". Esc closes. |
| **LanguageCard** | `name`, `born`, `epithet`, `blurb`, `snippet`, `traits[]`, `dialects[]`, `selected` | default · hover (lift 2px) · selected (candle border, glow, "✓ Selected") · focus ring · compact (mobile unselected: name, year, epithet, one-line blurb) | `role="radio"`. Content: COBOL 1959 *The ledger keeper*; Fortran 1957 *The calculator*; BASIC 1964 *The first teacher*. |
| **Pane** | `title`, `meta?`, `actions?` | default | Header 44px with display-italic title, dust meta, right-side actions. Radius 12, `--crypt`, `--shadow-pane`. |
| **CodePane** | `language`, `lines[]`, `activeRange`, `streaming`, `showColumns`, `onLineClick` | streaming (lines enter with `lineIn`) · narrating · error (`errorAt` line + token) · `showColumns` (COBOL cols 1–7) | `.crt` surface; Plex Mono 13/19; gutter line numbers in dust (candle when active). Active range: `--candle-veil` + 2px candle **bracket**. Contains a **Planchette**. Lines before the range dim to 72%. Auto-scrolls the range to about 30% from the top. |
| **Planchette** | `line`, `lineHeight` | moving · resting · reduced-motion (jump) | 14px mark in the gutter; `transform: translateY(line*lh)` with `--d-glide --ease-glide`; drop-shadow glow; `aria-hidden`. **Signature interaction.** |
| **GhostNarration** | `steps[]`, `activeIndex`, `onStep`, `speaking` | step: spoken (ash, clickable) · active (altar, candle edge, bone, caret) · ahead (55%, "The ghost hasn't reached line N yet.") · loading · unsupported-task card | Each step: VT323 ref `LINES a–b`, optional display-italic quote, DM Sans explanation. Footer: prev / Pause / next, `n of N`, and **AskGhost** input ("Ask about these lines…"). `aria-live="polite"`. Keys `j`/`k`. |
| **TranslationPane** | `lines[{text,maps}]`, `activeRange`, `note?` | default · streaming · mapped-line highlight | Title "Brought back", meta "Python 3". Lines whose `maps` intersect `activeRange` get the veil and show `↔ a–b` in VT323 at the right (hidden below 768). **TranslatorNote** (dashed seam box) explains semantic changes such as Decimal. |
| **RunOutput** | `runs:{source,python}`, `active`, `status` | idle · running · success · runtime error (danger text) · timeout | `.crt`, VT323 18/22 phosphor, `white-space: pre`, prompt lines start with `›` in phosphor-dim, and the result line uses `#D4F5DC` with `flickerIn` once. Segmented toggle COBOL / Python. `role="log"`. |
| **AgreementBar** | `match`, `sourceValue`, `pythonValue` | match "✓ Python agrees. Both runs print X." · mismatch (danger) "✕ Results differ: …" + Ask the ghost why · hidden while running | Sits at the bottom of RunOutput; `riseIn` on reveal. |
| **SegmentedControl** | `options[]`, `value`, `onChange` | default · mobile full-width (Code · Ghost · Python · Output) | Void track, altar selected pill, 24px tall (32px on mobile). Use `aria-pressed` for toggles, or `role="tablist"` for panel tabs. |
| **GhostCaption** (mobile) | `step`, `onPrev`, `onNext` | visible on the Code tab below 768 | Fixed bottom card 12px from the edges: ref + prev/next, quote, explanation. Code pane adds 170px bottom padding. |
| **EmptyState** | `suggestions[]`, `onPick` | – | "The candles are lit." + chips. |
| **SummoningSkeleton** | `lines` | – | CRT skeleton bars (phosphor 14%) with 40ms staggered `lineIn`; "› The ghost is writing. COBOL takes its time." |
| **ErrorState** | `kind`, `line?`, `token?`, `message`, `onFix`, `onEdit` | compile · runtime · timeout · unsupported | Danger wavy underline on the token; title in display italic ("The spirit lost the thread on line 27."); actions [Let the ghost fix it] [Edit the task]. |
| **Chip / Tag** | `label` | default · hover | 28px pill on altar (chips); 22px outline (trait tags). |
| **Kbd** | `keys` | on-candle · on-dark | Plex Mono 11px. |

### Data contracts the UI expects
```ts
type Step = { range:[number,number]; quote?: string; text: string };
type PyLine = { text: string; maps: [number,number] | null };
type Run = { stdout: string; stderr?: string; exitCode: number };
// highlight rule: pyLine.maps && maps[0] <= active[1] && maps[1] >= active[0]
```

## Layout and breakpoints
- `≥1200`: 3 columns; Python pane on top of RunOutput (208px) in column 3.
- `768–1199`: Code + one right panel chosen by tabs (Ghost default).
- `<768`: single panel, full-width SegmentedControl, GhostCaption docked on the Code tab, picker as a bottom sheet, Summon icon-only.
- The app fills `100vh` (minimum 720px); panes scroll internally and the page never scrolls in the workspace.

## Copy voice
- **Ghost:** dry, warm, slightly smug mainframe veteran. First person. At most **one** quip per step, *in the quote line only*, always followed by a plain-English explanation of what the code does. Explanations stay under 40 words. Name the real COBOL concept (PIC, DIVISION, UNSTRING), then the Python equivalent.
  - ✅ "*Before any work, you declare every box and its exact size.* PIC 9(7)V99 means seven digits, an invisible decimal point, then two more."
  - ❌ "Boooo! Spooky COBOL magic 👻"
- **UI labels:** plain verbs in sentence case. Summon, Summon again, End séance, Ask about these lines, Let the ghost fix it, Edit the task, Cancel. Use "Spirit" for the language selector.
- **Headlines:** human voice, with the second clause in italic serif candle. No exclamation marks.
- **Errors:** say what happened, where, and what to do next. "The spirit lost the thread on line 27." + the technical message in plain words.
- **Honesty:** no invented statistics, users, testimonials or "trusted by" logos. Footnote: "Generated code is for learning, not production."
- **Banned words:** Ouija, boo, spooky, mwahaha, haunted (in UI chrome), "AI magic".
- Codes, IDs, file names and technical asides go in `dust` footnotes or meta, not headlines.

## Do / Don't
| Do | Don't |
|---|---|
| App: candle amber + phosphor green on near-black, with ecto sparingly. Landing: charcoal card on burnt orange with a pumpkin accent | Purple/green Halloween palettes, blood red, pumpkin inside code panes |
| Jolly Lodger for landing display; Instrument Serif italic for app titles; DM Sans for reading | Dripping or gore fonts (Creepster, Nosifer, Butcherman), blackletter |
| Planchette, candle glow, static scanlines; on the landing also original cobwebs, a tiny spider, a jack-o'-lantern CRT and prop tiles | Skulls, gore, tombstones, emoji, cobwebs over text, cobwebs inside app panes |
| Animate `opacity` and `transform` only, with tokens | Animate box-shadow, filter, width/height, top/left |
| A single flicker-in on entry; breathing at 0.2Hz | Repeating flicker, glitch, screen shake, anything > 3 flashes/s |
| Honor `prefers-reduced-motion` everywhere | Auto-advancing narration by default |
| Keep linked highlighting in sync across code, ghost and Python | Explaining lines the user can't see highlighted |
| Show empty, summoning, error and mismatch states | Blank panes or spinner-only loading |
| Say "spirit board" and "planchette" | The word "Ouija", Hasbro board art, AWS/Kiro logos in the UI, the Python logo |
| 14px body, 28px titles in the app | Giant marketing type inside the workspace |
| Original inline SVG icons (1.2–1.6px strokes) | Icon fonts or third-party icon packs with unclear licenses |

## Runtime copy rule
Never say the whole thing "runs in your browser". Use: "Python runs in your browser. COBOL runs on a real GnuCOBOL compiler." (matches `.kiro/steering/product.md`).
