# Requirements Document

## Introduction

Séance turns a plain-English task into a real COBOL program, runs it on a real GnuCOBOL compiler, has a ghost programmer explain it line by line with linked highlighting, translates it to Python, runs the Python in the browser, and proves both runs agree. This spec covers the end-to-end MVP: one spirit (COBOL), the workspace screen, the landing page, and demo resilience. Runner internals are deepened in `proof-runner`; narration quality in `ghost-narrator`.

Visual source of truth: `design/mocks/workspace.html`, `design/mocks/landing.html`, `design/mocks/picker.html`, and `.kiro/steering/seance-design.md`.

## Glossary

- **Séance_App**: the browser application (React + Vite).
- **Summon_API**: the `/api/summon` Vercel Function that asks the LLM for a COBOL program.
- **Narrate_API**: the `/api/narrate` Vercel Function that asks the LLM for ghost steps and a line-mapped Python translation.
- **Run_API**: the `/api/run` Vercel Function that compiles and runs COBOL through the configured runner adapter.
- **Python_Runner**: the Pyodide Web Worker that runs the Python translation in the browser.
- **Séance**: one complete session object: task, optional CSV, COBOL program, COBOL run, steps, Python lines, Python run, agreement.
- **Step**: `{ range:[a,b], quote?, text }`, a narration unit tied to COBOL lines a..b (1-based, inclusive).
- **PyLine**: `{ text, maps:[a,b] | null }`, a Python line and the COBOL range it came from.
- **Active_Range**: the range of the currently active Step.
- **Result_Line**: an output line of the form `LABEL: value`.
- **Golden_Séance**: a cached, previously verified Séance stored in `src/fixtures/golden/` for a suggestion chip.
- **Planchette**: the gutter marker that glides to the first line of the Active_Range.

## Requirements

### Requirement 1: Task input

**User Story:** As a learner, I want to describe a task in plain English and optionally attach a small CSV, so that the ghost has something concrete to program.

#### Acceptance Criteria

1. THE Séance_App SHALL show a task input with the placeholder "Describe a task in plain English…" and focus it on load.
2. WHEN the user presses Ctrl+Enter or Cmd+Enter in the task input, THE Séance_App SHALL start a summon with the current task.
3. WHEN the user presses `/` outside a text field, THE Séance_App SHALL focus the task input.
4. WHEN the user attaches a CSV file of at most 64 KB and at most 500 data rows, THE Séance_App SHALL show a FileChip with the file name and data-row count.
5. IF the user attaches a file larger than 64 KB or with more than 500 data rows, THEN THE Séance_App SHALL reject it and show a plain message stating the limit.
6. IF the task is empty or only whitespace, THEN THE Séance_App SHALL keep the Summon button disabled.
7. THE Séance_App SHALL limit the task text to 500 characters and show the remaining count after 400.

### Requirement 2: Suggestions and empty state

**User Story:** As a first-time visitor or judge, I want one-click examples, so that I see the whole experience without thinking of a task.

#### Acceptance Criteria

1. WHILE no Séance has been summoned, THE Séance_App SHALL show the empty state "The candles are lit." with four suggestion chips: "Total the sales in a CSV", "Compound interest for 10 years", "Sort a list of names", "Payroll with overtime".
2. WHEN the user picks a suggestion chip that has a Golden_Séance, THE Séance_App SHALL load that Golden_Séance and play the full flow (code lines entering, run output, narration, Python, agreement bar) without calling Summon_API or Narrate_API.
3. WHEN a Golden_Séance plays, THE Séance_App SHALL label it in the pane meta as "cached séance" in `dust` text.

### Requirement 3: Summon a COBOL program

**User Story:** As a learner, I want the ghost to write real COBOL for my task, so that I can see how a mainframe programmer would solve it.

#### Acceptance Criteria

1. WHEN a summon starts, THE Séance_App SHALL send the task, the `language` field (always `'cobol'` for the MVP), and the optional CSV header row to Summon_API and set the status pill to "Summoning".
2. WHILE a summon is in progress, THE Séance_App SHALL show the SummoningSkeleton and the line "› The ghost is writing. COBOL takes its time."
3. WHEN Summon_API returns a program, THE Séance_App SHALL render each line in the CodePane with the `lineIn` entrance and a 40 ms stagger.
4. THE Summon_API SHALL validate the LLM response against the Program schema and SHALL return HTTP 502 with a plain message IF validation fails twice.
5. WHERE the LLM reports the task as unsupported, THE Séance_App SHALL show the unsupported-task card in the ghost pane and SHALL NOT call Run_API.
6. WHEN the user presses Esc during a summon, THE Séance_App SHALL abort the in-flight requests and return to the previous state.
7. THE Summon_API SHALL reject request bodies larger than 70 KB with HTTP 413. (Defense-in-depth: the `task ≤ 500 char` schema limit makes this unreachable through normal use, but the body-size guard still applies.)

### Requirement 4: Run the COBOL program

**User Story:** As a learner, I want the COBOL to actually compile and run, so that I trust what I am learning.

#### Acceptance Criteria

1. WHEN a program is received, THE Séance_App SHALL send its source and the encoded stdin to Run_API.
2. THE Run_API SHALL return `{ stdout, stderr, exitCode, compileError? }` where every line number in `compileError` refers to the source lines the user sees.
2a. IF the `language` field in a Run_API request is `'fortran'` or `'basic'`, THE Run_API SHALL reject it with HTTP 400 and the message "This spirit is resting." (These languages are reserved for a future release; the schema accepts the union for forward compatibility.)
3. WHEN the run succeeds, THE Séance_App SHALL print the output in the RunOutput pane in VT323 with the `flickerIn` entrance applied once to the Result_Line.
4. IF the program fails to compile, THEN THE Séance_App SHALL show the compile-error state with the offending line underlined and the actions "Let the ghost fix it" and "Edit the task".
5. IF the run exceeds the runner time limit, THEN THE Séance_App SHALL show the timeout state "The program ran, then stopped answering after N seconds."
6. THE Run_API SHALL never expose runner API keys to the client.

### Requirement 5: Ghost narration with linked highlighting

**User Story:** As a learner, I want the ghost to walk me through the program step by step with the code lit up, so that I connect each explanation to real lines.

#### Acceptance Criteria

1. WHEN the program compiles, THE Séance_App SHALL request steps and Python lines from Narrate_API with the numbered COBOL source.
2. THE Séance_App SHALL show steps in three states: spoken (clickable), active, ahead (55% opacity, "The ghost hasn't reached line N yet.").
3. WHEN the active step changes, THE Séance_App SHALL move the Planchette to the first line of the Active_Range using `--d-glide` and `--ease-glide`, and scroll the range to about 30% from the top of the CodePane.
4. WHEN the active step changes, THE Séance_App SHALL highlight every PyLine whose `maps` intersects the Active_Range and SHALL show its `↔ a–b` back-reference at widths of 768 px and above.
5. WHEN the user presses `j` or `k`, or clicks a spoken step, THE Séance_App SHALL change the active step and update all panes in the same frame.
6. THE Séance_App SHALL NOT auto-advance narration unless the user presses Play.
7. THE Séance_App SHALL announce only the active step through an `aria-live="polite"` region.

### Requirement 6: Bring it back to Python

**User Story:** As a modernizer, I want a line-mapped Python translation that runs, so that I can see the modern equivalent and compare outputs.

#### Acceptance Criteria

1. WHEN Python lines are received, THE Séance_App SHALL render them in the TranslationPane with the title "Brought back" and meta "Python 3".
2. WHEN Python lines are received, THE Python_Runner SHALL run the Python with the same stdin used for COBOL.
3. WHERE the translation changes semantics (for example fixed-point to Decimal), THE Séance_App SHALL show the TranslatorNote.
4. IF the Python run raises an exception or exceeds 10 seconds, THEN THE Séance_App SHALL show the runtime-error state in the Python output tab.

### Requirement 7: Agreement bar (proof)

**User Story:** As a judge, I want an unmistakable proof moment, so that I believe the translation is faithful.

#### Acceptance Criteria

1. WHEN both runs finish, THE Séance_App SHALL compare their Result_Lines and show the AgreementBar with `riseIn`.
2. WHEN every result label is present in both runs with equal normalized values, THE Séance_App SHALL show "✓ Python agrees. Both runs print X." where X is the COBOL text of the last Result_Line value, trimmed.
3. IF any label is missing or any value differs, THEN THE Séance_App SHALL show the danger bar "✕ Results differ: COBOL A, Python B" and the action "Ask the ghost why".
4. IF either run produced no Result_Line, THEN THE Séance_App SHALL show "No result line to compare." instead of a match.
5. WHILE either run is in progress, THE Séance_App SHALL hide the AgreementBar.

### Requirement 8: Demo resilience

**User Story:** As Douglas, I want the live link to work during judging even when free tiers are exhausted, so that judges always see the product.

#### Acceptance Criteria

1. THE Séance_App SHALL ship one Golden_Séance per suggestion chip, each captured from real runs (not hand-written output).
2. IF Summon_API, Narrate_API or Run_API returns HTTP 429 or 5xx, THEN THE Séance_App SHALL show "The spirits are busy. Try a cached séance." with the suggestion chips.
3. THE Run_API SHALL fall back to the next configured runner adapter when the primary adapter returns 429 or 5xx.

### Requirement 9: Spirit picker

**User Story:** As a learner, I want to see which dead languages exist, so that I know what Séance can summon.

#### Acceptance Criteria

1. WHEN the user opens the LanguageTrigger, THE Séance_App SHALL show the LanguagePicker dialog with COBOL, Fortran and BASIC cards in a radiogroup.
2. WHERE a spirit is not yet enabled, THE Séance_App SHALL show its card as "Resting" and SHALL NOT allow it to be selected.
3. WHEN the picker is open, THE Séance_App SHALL trap focus, move selection with arrow keys, and close on Esc.

### Requirement 10: Responsive and accessible

**User Story:** As a mobile user or keyboard user, I want the workspace to work on my device, so that I can follow the séance anywhere.

#### Acceptance Criteria

1. THE Séance_App SHALL use three columns at widths of 1200 px and above, code plus a tabbed right column from 768 to 1199 px, and one panel with a Code · Ghost · Python · Output segmented control below 768 px.
2. WHILE the Code tab is shown below 768 px, THE Séance_App SHALL dock the GhostCaption at the bottom.
3. WHILE `prefers-reduced-motion: reduce` is set, THE Séance_App SHALL jump the Planchette, show whole lines at once, and stop breathing and caret animations.
4. THE Séance_App SHALL show a visible `:focus-visible` ring on every interactive element.

### Requirement 11: Landing page

**User Story:** As a visitor, I want to understand Séance in ten seconds, so that I click "Begin a séance".

#### Acceptance Criteria

1. THE Séance_App SHALL serve the landing page at `/` matching `design/mocks/landing.html`, and the workspace at `/seance`. (Route `/seance` is the canonical workspace path.)
2. WHEN the user clicks "Begin a séance", THE Séance_App SHALL open `/seance` with the empty state.
3. THE Séance_App SHALL show the footnote "Python runs in your browser. COBOL runs on a real GnuCOBOL compiler. Generated code is for learning, not production."
4. THE Séance_App SHALL NOT show any statistic without a visible source link.

### Requirement 12: Safety and limits

**User Story:** As the owner of free-tier keys, I want abuse limits, so that one visitor cannot burn the quota.

#### Acceptance Criteria

1. THE Summon_API, Narrate_API and Run_API SHALL read secrets only from server environment variables.
2. THE Run_API SHALL reject COBOL source longer than 20 000 **characters** or stdin longer than 70 000 **characters** with HTTP 413. (Character limits, matching the `RunReq` schema in design.md — not byte counts.)
3. THE Summon_API, Narrate_API and Run_API SHALL apply a best-effort per-IP limit of 10 requests per minute and return HTTP 429 above it.
4. THE Summon_API and Narrate_API SHALL cache successful responses by a hash of their inputs for the lifetime of the function instance.
