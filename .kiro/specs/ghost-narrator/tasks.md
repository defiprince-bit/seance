# Implementation Plan

- [ ] 1. Procedure-line detection and coverage
- [ ] 1.1 Implement `src/lib/cobolLines.ts` and `src/lib/coverage.ts`
  - _Requirements: 1.2_
- [ ] 1.2 Example tests on the golden sales program
  - _Requirements: 1.2_

- [ ] 2. Step repair
- [ ] 2.1 Implement `src/lib/repairSteps.ts` and wire it into `api/narrate.ts` after one retry
  - _Requirements: 1.1, 1.3, 1.4_
- [ ] 2.2 Property tests: repair validity, coverage and identity (Properties 1, 2, 3)
  - _Requirements: 1.1, 1.2, 1.3_
- [ ] 2.3 Property test: Python maps sanitized (Property 5)
  - _Requirements: 1.4_

- [ ] 3. Voice lint
- [ ] 3.1 Implement `src/lib/voiceLint.ts` and apply `fixVoice` server-side
  - _Requirements: 2.1, 2.2, 2.3_
- [ ] 3.2 Property test: voice fix converges (Property 4)
  - _Requirements: 2.1, 2.2_

- [ ] 4. Let the ghost fix it
  - `mode: "fix"` in summon prompt, 2-attempt limit in the reducer, explanatory first step
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Speaking reveal
  - Word spans with staggered opacity, instant finish on step change, reduced-motion path
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 6. Ask about these lines
  - `api/ask.ts` (`mode: "lines"`), AskGhost input under the active step
  - _Requirements: 4.1, 4.2, 4.3_

- [ ]* 7. Ask the ghost why (mismatch)
  - `mode: "mismatch"`, cause categories, wired to the danger AgreementBar
  - _Requirements: 6.1, 6.2_
