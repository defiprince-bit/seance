# Requirements Document

## Introduction

The ghost-narrator makes the explanation the best part of Séance: grounded line ranges, full coverage of the program, a consistent voice, a fix-it loop for compile errors, and follow-up questions. It deepens `seance-core` tasks 5, 7 and 8.

## Glossary

- **Narrator**: the server logic behind `/api/narrate` and `/api/ask`.
- **Coverage**: the set of PROCEDURE DIVISION line numbers included in at least one Step range.
- **Voice_Lint**: a pure function that checks generated text against the copy-voice rules.
- **Fix_Loop**: sending a compile error back to the model to get a corrected program.

## Requirements

### Requirement 1: Grounded, complete steps

**User Story:** As a learner, I want every important line explained in order, so that nothing is skipped or invented.

#### Acceptance Criteria

1. THE Narrator SHALL return between 1 and 10 Steps (the prompt asks for 4–10) whose ranges are ascending, non-overlapping and inside the program.
2. THE Narrator SHALL ensure every non-blank, non-comment PROCEDURE DIVISION line is covered by a Step.
3. IF the model's Steps fail rule 1 or 2, THEN THE Narrator SHALL retry once with the validation errors listed, and SHALL otherwise repair them deterministically (clamp, sort, merge overlaps, add a final "The rest of the procedure" step for uncovered lines).
4. THE Narrator SHALL return Python lines whose `maps` ranges are inside the program or `null`.

### Requirement 2: Voice

**User Story:** As Douglas, I want the ghost to sound like the design's dry, kind veteran, so that the product feels crafted.

#### Acceptance Criteria

1. THE Voice_Lint SHALL flag any Step text over 40 words, any exclamation mark, any emoji, and any banned word (Ouija, boo, spooky, mwahaha, "AI magic").
2. WHEN Voice_Lint flags a Step, THE Narrator SHALL drop the quote first and, if the text still fails, truncate the text at the last full sentence under 40 words.
3. THE Narrator SHALL name the real COBOL construct in each Step text when its range contains a COBOL verb from the primer list.

### Requirement 3: Let the ghost fix it

**User Story:** As a learner, I want a one-click fix when the COBOL does not compile, so that I learn from the mistake instead of stopping.

#### Acceptance Criteria

1. WHEN the user clicks "Let the ghost fix it", THE Séance_App SHALL send the task, the source and the remapped compile error to `/api/summon` with `mode: "fix"`.
2. THE Séance_App SHALL allow at most 2 fix attempts per séance and then show "The spirit gave up. Edit the task."
3. WHEN a fixed program compiles, THE Séance_App SHALL add a first Step that explains what was wrong, ranged on the corrected line.

### Requirement 4: Ask about these lines

**User Story:** As a learner, I want to ask a follow-up about the highlighted lines, so that I can dig deeper.

#### Acceptance Criteria

1. WHEN the user submits a question in AskGhost, THE Séance_App SHALL send the question, the Active_Range and those source lines to `/api/ask`.
2. THE `/api/ask` endpoint SHALL answer in at most 80 words in the ghost's voice and SHALL refuse questions unrelated to the program with a one-line redirect.
3. THE Séance_App SHALL show the answer under the active Step without changing the Active_Range.

### Requirement 5: Speaking reveal

**User Story:** As a viewer, I want the active step to appear as if spoken, so that the séance feels alive without slowing me down.

#### Acceptance Criteria

1. WHEN a Step becomes active for the first time, THE Séance_App SHALL reveal its text word by word at 30 ms per word with the ecto caret.
2. WHEN the user changes step during a reveal, THE Séance_App SHALL show the previous step's full text immediately.
3. WHILE reduced motion is requested, THE Séance_App SHALL show full text at once with no caret blink.

### Requirement 6: Results differ explanation

**User Story:** As a learner, I want to know why COBOL and Python disagree, so that the mismatch becomes a lesson.

#### Acceptance Criteria

1. WHEN the user clicks "Ask the ghost why", THE Séance_App SHALL send both outputs, the source and the Python to `/api/ask` with `mode: "mismatch"`.
2. THE answer SHALL name the most likely cause category (rounding, truncation by PIC size, sign handling, input parsing) and the lines involved.
