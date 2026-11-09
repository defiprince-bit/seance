# Séance: design direction

> **Revision v2 (9 Nov 2026).** After review, Douglas asked for a landing "like" a Halloween-decor Dribbble reference, **with the webs**. That **reverses §1's "no cobwebs / not cheesy" rule for the landing only**; see §11. The workspace and picker keep the calm direction below and gain only a Jolly Lodger pumpkin wordmark and one faint top-bar cobweb.

*Ask in plain English. A programmer from 1959 answers.*

Visual source of truth: `mocks/landing.html`, `mocks/workspace.html`, `mocks/picker.html` (screenshots in `shots/`).
Tokens and components for Kiro: `seance-steering.md` (drop into `.kiro/steering/`).
Logo: `logo-mark.svg` (mark only), `logo-wordmark.svg` (mark + italic serif wordmark).

---

## 1. Direction in one paragraph

A dark room, one candle, and an old terminal still warm. Séance should feel like a quiet late-night session with a patient senior engineer, not a Halloween party. The spooky part comes from **light and timing**, not clip art. We use candlelight amber against near-black, phosphor-green code on a faint scanline surface, a slow glow that breathes, and a small planchette that glides to the line being explained. Typography does the rest: a calm italic serif for human moments (titles, the ghost's voice) and a soft sans for everything you need to read quickly.

**It is:** restrained, cinematic, warm, legible, a bit dry and funny in the copy.
**It is not:** cartoon ghosts, skulls, bats, cobwebs, dripping or "horror" fonts, blood red, purple-and-green Halloween palettes, Comic-style lettering, or fake glitch effects.

### Motifs we own (all original)
| Motif | Where | How |
|---|---|---|
| **Planchette** | Logo mark, code-gutter cursor, ghost avatar | Rounded teardrop with a round window. Inside the window sits a phosphor text cursor. |
| **Spirit board alphabet** | Landing hero only | A thin arc of serif letters A–Z at 28% opacity above the product preview. Generic alphabet, no board artwork, no third-party marks. |
| **Candle** | Primary buttons, hero, picker dialog | A soft radial glow whose *opacity* breathes on a 4.8s cycle. |
| **CRT** | Code panes, run output | `--terminal` surface, static 1px scanlines at 1.8% white, a faint phosphor text-shadow. No barrel distortion and no rolling bars. |
| **Roman numerals** | Step labels (I. II. III.) | Italic serif in candle. |

Naming: say *spirit board*, *planchette*, *séance*, *summon*, *spirit*, *ghost*. **Never** "Ouija" anywhere in the product, copy, file names, or the video.

---

## 2. Palette

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `void` | `#0A090C` | App background | n/a |
| `crypt` | `#121015` | Panes, cards | n/a |
| `altar` | `#1A171E` | Inputs, active rows, menus | n/a |
| `terminal` | `#0D110E` | CRT code and output surface | n/a |
| `seam` / `seam-strong` | `#2B2631` / `#3D3645` | Hairlines / hover borders | n/a |
| `bone` | `#EDE6D8` | Primary text | 15.2:1 on crypt |
| `ash` | `#B3A999` | Secondary text | 8.1:1 |
| `dust` | `#8E8578` | Footnotes, line numbers, placeholders | 5.2:1 (4.9 on altar) |
| `candle` | `#E9A957` | Primary action, active line, focus ring, emphasis in titles | 9.3:1 |
| `candle-ink` | `#1A1006` | Text on candle buttons | 9.2:1 |
| `phosphor` | `#9FDDB0` | Dead-language code, success | 12.1:1 on terminal |
| `phosphor-dim` | `#74A983` | Code comments | 7.0:1 on terminal |
| `ecto` | `#C7C0E6` | The ghost's voice: epithets, PIC clauses, caret | 10.9:1 |
| `danger` | `#EE8E7E` | Errors | 7.9:1 |
| `pumpkin` (v2) | `#FF4A2E` | Landing accent word, round CTA dots, wordmark | 4.6:1 on #242428 |
| `charcoal` (v2) | `#242428` | Landing card | n/a |
| backdrop (v2) | burnt-orange gradient `#D8622F` / `#C25A2C` / `#9C4524` | Landing page behind the card | n/a |

All text pairs pass **WCAG AA** (most pass AAA). Hue budget: **one** warm accent (candle) and **one** cool accent (phosphor). Ecto appears in small amounts only.

## 3. Type

All fonts are Google Fonts under the SIL Open Font License.

| Use | Font | Size / leading |
|---|---|---|
| Landing display + wordmark (v2) | **Jolly Lodger** | Landing H1 80, H2 56, wordmark 27–34 |
| App titles, pane titles, ghost quotes | **Instrument Serif** (italic for emphasis) | Hero 56/1.02 (landing only), H2 40/1.1, page title 28/1.1, pane title 19, ghost quote 18/1.3 |
| UI and body | **DM Sans** 400/500/600 | Body 14/1.55, small 13, caption 12, large body 16 |
| Code | **IBM Plex Mono** 400/500 | 13/19 in panes (12/19 on mobile) |
| Run output, line refs, year badges | **VT323** (sparingly) | 18/22 output, 15 refs |

House style (Douglas): human-voice headlines, with the second clause in *italic serif in candle* ("Three steps, *one very old friend.*"). Body text stays soft sans. Codes, IDs and technical detail go into footnotes in `dust`. Product scale stays normal: 14px body and 28px titles inside the app. The 56px size is for the landing hero only.

## 4. Core screens

### 4.1 Landing (`mocks/landing.html`)
1. **TopBar:** mark + *Séance* wordmark; links (How it works · The spirits · Why COBOL); candle CTA "Begin a séance".
2. **Hero (5/7 split):** eyebrow "A trainer for languages that won't stay buried"; H1 "Ask in plain English. *A programmer from 1959 answers.*"; one-paragraph lede; CTAs (primary + outline); footnote "Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production." On the right sits a live-looking **product preview**: the task line, COBOL lines 23–33 with lines 27–29 lit, the ghost's quote, and a Python strip with "✓ Both print 5871.50". Behind it are the alphabet arc and the breathing candle glow.
3. **How a séance works:** three cards, I. Say what you need · II. The ghost writes and runs it · III. Bring it back to Python.
4. **The spirits:** COBOL (b. 1959, *The ledger keeper*), Fortran (b. 1957, *The calculator*), BASIC (b. 1964, *The first teacher*), each with a 2-line snippet and a single honest sentence.
5. **Why it matters:** a large italic statement about retiring maintainers of systems that pay pensions and move money, with three bullets. **No fabricated stats or testimonials.** If we cite a number in the video, it needs a source on screen.
6. **Final CTA** "The candles are lit. *Ask anything.*" and a footer disclaimer.

### 4.2 Séance workspace (`mocks/workspace.html`), the hero screen
Flow, left to right: **task → dead-language code → ghost explanation → Python + output.**

```
┌ TopBar: mark · Séance │ "Sales total" (rename) ········ [Spirit COBOL ▾] (●Spirit present) End séance ┐
├ TaskInput: → "Parse sales.csv and total the sales column"   [sales.csv · 4 rows]   [Summon again ⌘⏎] ┤
├──────────── CodePane 1.3fr ────────────┬── GhostNarration 1fr ──┬── TranslationPane 1fr ──────┤
│ COBOL · sales-total.cbl · 37 lines      │ The ghost              │ Brought back · Python 3      │
│ [Code area | Cols 1–7] [copy]           │ LINES 1–2  (spoken)    │ 1 from decimal import …      │
│ 23 PERFORM UNTIL WS-EOF = "Y"           │ …                      │ 6 for row in csv.DictReader  │ ← lit, ↔ 22–29
│ 27◉│UNSTRING SALES-LINE DELIMITED BY ","│ ▌LINES 27–29 (active)  │ Translator's note (Decimal)  │
│ 28 │  INTO WS-REGION WS-AMOUNT-TXT      │ "We had no split()…"   ├── RunOutput ─────────────────┤
│ 29 │END-UNSTRING                        │ LINES 30–31 (ahead)    │ › summon sales-total.cbl     │
│ …                                       │ ‹  ❚❚ Pause  ›   6 of 8│ TOTAL SALES:      5871.50    │
│                                         │ [Ask about these lines]│ ✓ Python agrees. 5871.50     │
└─────────────────────────────────────────┴────────────────────────┴──────────────────────────────┘
```
- **Linked highlighting is the core idea.** The active narration step lights its COBOL range (candle veil + 2px candle bracket), and the planchette sits in the gutter at the first line. The Python lines mapped to that range light up and show an `↔ 22–29` back-reference. Clicking a spoken step or pressing `j`/`k` moves all three.
- **Narration states:** *spoken* (ash text, clickable), *active* (altar card, candle edge, bone text, ecto caret while it is "speaking"), *ahead* (55% opacity, italic "The ghost hasn't reached line 30 yet."). Nothing is revealed before the ghost gets there.
- **"Cols 1–7"** toggle shows COBOL's fixed-format sequence and indicator columns, a small teaching moment for "why is everything indented?"
- **Output** tabs switch between the COBOL and Python runs. The **agreement bar** ("✓ Python agrees. Both runs print 5871.50.") is the proof moment for the demo. When the results differ, it turns danger: "✕ Results differ: COBOL 5871.50, Python 5871.5" with "Ask the ghost why".
- **Translator's note** explains any semantic change (fixed-point → `Decimal`). This is where the teaching value lives.

**States** (bottom of `workspace.html`, or `?states=1`):
| State | Visual | Copy |
|---|---|---|
| Empty | Task input focused with candle glow; panes show an italic serif title; four suggestion chips | "The candles are lit." · chips: Total the sales in a CSV / Compound interest for 10 years / Sort a list of names / Payroll with overtime |
| Summoning | Pill turns candle "Summoning". CRT skeleton lines `lineIn` with a 40ms stagger; real lines replace them as they stream | "› The ghost is writing. COBOL takes its time." · footnote "Press Esc to stop." |
| Narrating | As in the mock | The pill reads "Spirit present" |
| Compile error | Pill danger "Didn't compile"; offending token gets a wavy danger underline on a danger-tinted background | "The spirit lost the thread on line 27." + plain error + [Let the ghost fix it] [Edit the task] |
| Runtime error / timeout | Output pane shows the stderr in danger VT323; agreement bar hidden | "The program ran, then stopped answering after 5 seconds." |
| Results differ | Agreement bar in danger | see above |
| Unsupported task | Inline card in the ghost pane | "That's a job for a modern language. COBOL never had to talk to a webcam. Try something with files, numbers, or records." |

### 4.3 Language picker (`mocks/picker.html`)
A modal dialog over the dimmed workspace (bottom sheet on mobile). Title "Who should *answer?*" Three **LanguageCards** in a `radiogroup`, each showing an italic serif name, a VT323 birth year, an ecto epithet, one honest sentence, a 3–4 line snippet, three trait chips, and a dialect select (COBOL-85 fixed format / Fortran 90 free form / Classic line-numbered BASIC). The selected card gets a candle border, glow and "✓ Selected". The CTA label follows the choice ("Summon with Fortran"). The footnote nudges people toward COBOL and mentions that "ALGOL, Pascal and friends are still resting."

## 5. Signature interactions and micro-animations

All animations use **opacity and transform only** (no animated box-shadow, filter, width, or layout). Durations come from tokens.

| # | Interaction | Spec |
|---|---|---|
| 1 | **Planchette glide** (signature) | When the active step changes, the gutter planchette `translateY`s to the first line of the range over `--d-glide` 600ms with `--ease-glide`. The bracket moves with it (transform; height snaps). The code pane scrolls so the range sits about 30% from the top (smooth). Python mapped lines fade their veil in over 160ms. |
| 2 | **Typewriter summoning** | While code streams, each new line enters with `lineIn` (opacity 0→1, translateX −4px→0, 240ms, 40ms stagger). The ghost's active paragraph reveals word by word (opacity per word span, 30ms/word), with a ▍ caret blinking at 1.06s per cycle (under 1Hz). |
| 3 | **Phosphor flicker-in** | A single-use entrance for CRT text and the hero: opacity 0 → .75 → .5 → 1 over 420ms. It runs **once per element**, with one dip, so it never repeats or strobes. Use it for run output lines and the "TOTAL SALES" result. |
| 4 | **Candle breathing** | A `::after` glow on primary buttons, the status-pill dot, the hero and the picker dialog animates **opacity** .35↔.85 on a 4.8s ease-in-out loop (0.2Hz). |
| 5 | **Summon press** | The button moves `translateY(1px)` on press (80ms). After that the task input border fades to candle, and the status pill crossfades "Spirit present" → "Summoning" (160ms). |
| 6 | **Agreement reveal** | When both runs finish, the bar rises in (`riseIn` 420ms) and the ✓ fades in 120ms later. This is the demo's "aha" beat. |
| 7 | **Card hover** | Language and spirit cards: `translateY(-2px)` over 240ms; border color 160ms. |
| 8 | **Dialog** | The scrim fades over 240ms. The dialog fades and rises 6px over 420ms; on mobile it rises from the bottom. |

**Reduced motion** (`prefers-reduced-motion: reduce`): durations collapse to 1ms. The planchette jumps, streaming shows whole lines at once, breathing stops at a static 50% glow, the caret stops blinking, and smooth scroll becomes instant. Narration auto-advance stays user-paced either way, because it is never automatic by default.

## 6. Mobile and responsive

| Breakpoint | Layout |
|---|---|
| ≥ 1200px | Three columns (Code 1.3fr · Ghost 1fr · Python+Output 1fr); task bar full width |
| 768–1199px | Two columns: Code always visible, and the right column is a tab switcher (Ghost · Python · Output, aligned right above it). Picker cards go 2-up. |
| < 768px | One panel at a time with a full-width segmented control (**Code · Ghost · Python · Output**) under the task bar. On the Code tab, a **ghost caption card** is docked at the bottom (line ref, prev/next, quote, explanation), so you can read code and explanation together without switching. The code pane gets 170px of bottom padding so the caption never hides the last lines. The task bar shrinks to one line, the file chip is hidden, and Summon becomes a 46px icon button (↵) with an aria-label. The topbar keeps only the mark, wordmark and Spirit selector. Pane meta is hidden and Python back-references hide. The picker becomes a bottom sheet; unselected cards collapse to name, year, epithet and a one-line description. |

Notes: code never wraps. It scrolls horizontally, with 12px Plex Mono on mobile. Touch targets are at least 44px for primary controls (segmented tabs are 32px tall but full-width and well spaced; bump them to 40px if testing says so). The landing hero H1 is 40px on mobile, and the preview stacks code over the ghost.

## 7. Accessibility
- **Contrast:** every text token is ≥ 4.5:1 on its surface (table in §2). `dust` is the floor; don't go dimmer for text.
- **Focus:** `:focus-visible` shows a 2px void gap + 2px candle ring (`--ring`) on every interactive element. The task input uses a candle border plus glow.
- **Flashing:** nothing flashes more than three times a second. Flicker-in is one dip, once. The caret runs at 0.94Hz. Scanlines are static. There are no full-screen flashes on errors.
- **Semantics:** the picker is `role="dialog" aria-modal` with a `radiogroup`, and arrow keys move the selection. Narration is `aria-live="polite"` and announces only the active step. Run output is `role="log"`. The status pill is `role="status"`. Mobile tabs use `role="tablist"`.
- **Color is never the only signal:** the active line has a bracket and planchette as well as the tint, errors have an underline and text, and success has ✓ and text.
- **Keyboard:** `⌘/Ctrl+Enter` summons, `j`/`k` step the ghost, `Esc` stops summoning or closes the dialog, and `/` focuses the task.
- The decorative alphabet arc, candle glows and scanlines are `aria-hidden`.

## 8. Copy voice (summary; full rules in the steering doc)
The ghost is a dry, kind, slightly smug programmer from the mainframe era. First person, past tense about "my day", present tense about the code. One quip at most per step, and always followed by a plain explanation. Example: "*We had no split(). We had UNSTRING, and we liked it.* It cuts each line at the comma and pours the pieces into two boxes: region, then amount." UI copy stays plain: verbs like Summon, End séance, Ask about these lines. Never say "boo", "spooky", or "mwahaha".

## 9. Legal and asset hygiene
- Fonts: Instrument Serif, DM Sans, IBM Plex Mono, VT323, all OFL via Google Fonts.
- Logo and all icons are original inline SVG (planchette mark drawn for this project). No icon packs are needed.
- No "Ouija" wording or board imagery (it's a Hasbro trademark). No AWS or Kiro logos in the UI; credit the tooling in the README and the video narration instead.
- Language names (COBOL, Fortran, BASIC, Python) are used descriptively, set in our own type, with no logos (notably, no Python snake logo).

## 10. Build notes for a two-week scope
- Plain React + CSS custom properties (Tailwind optional: map tokens in `theme.extend`). No animation library; CSS keyframes plus one `transform` set in JS for the planchette.
- Explanations come back from the model as `{steps:[{range:[a,b], quote?, text}]}`, and Python as `{lines:[{text, maps:[a,b]|null}]}`. The linked highlighting is just range intersection.
- Cut order if time runs short: (1) Cols 1–7 toggle, (2) Ask the ghost follow-up input, (3) dialect select, (4) tablet layout (fall back to mobile tabs below 1200px). **Never cut:** the planchette glide, the agreement bar, or the empty, loading and error states. The design score depends on them.

---

## 11. Landing v2: playful spooky (supersedes §1 and §4.1 for the landing)

**Reference cues taken** (no assets or text copied): a rounded charcoal card floating on a burnt-orange backdrop, white line-art cobwebs in the top-right and bottom-left corners crossing the card edge, a chunky hand-cut headline with one red accent word, a big glowing 3D object on the right, a pill CTA with a red circular icon next to an underlined link, two rounded prop tiles bottom-left, and outline chips bottom-right.

**Our version** (`mocks/landing.html`, `shots/landing-*.png`):
- **Backdrop** `--backdrop` (radial burnt orange #D8622F / #C25A2C over a linear #5E5752 → #9C4524) plus `--vignette`. **Card** `--charcoal` #242428 with radius 24 and 40/48px page padding.
- **Headline** in **Jolly Lodger** 80px, set on two lines: "Ask in plain English, / get an answer from **1959**", with 1959 in `--pumpkin` #FF4A2E. Body in DM Sans 16px #C9C4BC.
- **Hero object:** an original generated 3D render of a cream 1960s terminal whose green screen glows with a carved jack-o'-lantern face, a pumpkin stem on top, standing on punch cards on a patch of grass. It sits on a breathing pumpkin glow and floats 8px. No logos. Files: `assets/hero-terminal-dark.jpg` (used, blended with `lighten` + radial mask) and `assets/hero-terminal.png` (keyed cutout). The source render is `assets/src-hero-terminal.jpg`.
- **CTA:** a "Begin a séance" pill with a pumpkin circle and white planchette icon, plus a "See how it works" underlined link. The nav has two round buttons (dark "Inside a séance", pumpkin planchette → workspace).
- **Prop tiles:** a witch hat on an orange floppy disk (`assets/prop-hat-floppy.png`) and a dripping candle on punch cards (`assets/prop-candle-cards.png`). Both are generated originals cut out with `src/cutout.py`, overflow the tile top and float 6px. They have no captions, so a web can cross them.
- **Chips:** COBOL · Fortran · BASIC · Line-by-line ghost · Back to Python · Real GnuCOBOL compiler.
- **Cobwebs:** original procedural SVG `assets/cobweb.svg` (9 spokes, 8 sagging rings, a few broken strands, 1.5px non-scaling cream strokes at 72%). Placed top-right (340px, with a tiny spider dangling on a thread), bottom-left (280px, over the first tile corner) and bottom-right of the footer (220px). They sway 1.2° over 7s. They never sit over text; nav buttons and footer copy are padded clear.
- **Below the fold** (same card): How it works (pumpkin number circles, Jolly Lodger card titles), Inside a séance (the calm product preview, to show the real UI), The spirits, Why COBOL, a final CTA and the footer. Section H2s use Jolly Lodger 56px with one pumpkin phrase.
- **Mobile (<768):** the card goes full-bleed with no radius. The hero object (300px) moves **above** the headline (54px; "1959" wraps to its own line). Chips move under the CTAs. The top-right web shrinks to 130px, the bottom-left web is hidden (it would cross text), and the tiles split the width.
- **Motion:** web sway, spider dangle, object and prop float, and glow breathe all use transform/opacity only. Every one stops under `prefers-reduced-motion`.
- **Accessibility:** pumpkin on charcoal is 4.6:1, body 8.9:1 and muted 5.2:1. Decorative webs, spider and glow are `aria-hidden`. The hero image has descriptive alt text; tiles are links with aria-labels.

**What changed in the app:** the wordmark is now Jolly Lodger in `--pumpkin` (via `.brand b`), plus one 64px cobweb at 34% in the top-right of the top bar (`.topbar-web`), with padding so it never touches controls. Code, narration, output and picker content are unchanged.

**Asset paths:** `assets/hero-terminal-dark.jpg`, `assets/hero-terminal.png`, `assets/prop-hat-floppy.png`, `assets/prop-candle-cards.png`, `assets/cobweb.svg`, and source renders `assets/src-*.jpg`. The v1 landing source is kept at `src/landing-v1.src.html`.
