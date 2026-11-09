# Requirements Document

## Introduction

The proof-runner makes the "both runs agree" claim trustworthy. It owns the runner adapters (hosted GnuCOBOL, self-hosted fallback, fixtures), the stdin protocol shared by COBOL and Python, compiler-message line remapping, result comparison, and the stretch spirits (Fortran, BASIC). It hardens what `seance-core` task 3 and task 6 built first.

## Glossary

- **Runner_Adapter**: a server module with `run(req: RunReq): Promise<Run>`.
- **Runner_Chain**: the ordered list of adapters from `RUNNER_KIND` plus fallbacks.
- **Stdin_Protocol**: the text format both programs read: line 1 = data-row count N, then N data rows, header removed.
- **Result_Line**: an output line matching `^([A-Z][A-Z0-9 ]{0,39}):\s*(.+)$`.
- **Self_Host_Runner**: a small Docker web service with GnuCOBOL installed, deployed on a free host.

## Requirements

### Requirement 1: Runner adapters and fallback

**User Story:** As Douglas, I want the run step to survive one provider failing, so that the live demo keeps working on free tiers.

#### Acceptance Criteria

1. THE Run_API SHALL build the Runner_Chain from `RUNNER_KIND` followed by every other configured adapter, ending with the fixtures adapter.
2. WHEN an adapter returns HTTP 429, HTTP 5xx or a network error, THE Run_API SHALL try the next adapter in the Runner_Chain.
3. WHEN an adapter returns a compile error or a non-zero exit code, THE Run_API SHALL return that result and SHALL NOT fall back.
4. THE Run_API SHALL include the adapter name in `Run.runner`.
5. WHERE the fixtures adapter answers, THE Run_API SHALL only answer for sources whose SHA-256 matches a golden fixture, and SHALL otherwise return HTTP 503.

### Requirement 2: Stdin protocol

**User Story:** As a learner, I want COBOL and Python to read exactly the same input, so that a match means something.

#### Acceptance Criteria

1. THE Stdin_Protocol encoder SHALL drop the CSV header row, trim trailing empty lines, and prefix the data-row count on its own line.
2. THE Stdin_Protocol encoder SHALL normalize line endings to `\n`.
3. WHEN no CSV is attached, THE Stdin_Protocol encoder SHALL produce `0\n`.
4. THE decoder SHALL return exactly the rows the encoder received (header removed) for any CSV without embedded newlines.

### Requirement 3: Compiler messages map to visible lines

**User Story:** As a learner, I want errors to point at the line I can see, so that I can find the mistake.

#### Acceptance Criteria

1. WHEN the runner prepends N directive lines, THE Run_API SHALL subtract N from every line number in compiler messages of the form `<file>:<line>:`.
2. IF a remapped line number would be below 1, THEN THE Run_API SHALL report line 1.
3. THE Run_API SHALL extract the first error line and message into `Run.compileError`.

### Requirement 4: Result comparison

**User Story:** As a judge, I want "agrees" to mean the same numbers, not the same formatting, so that padding does not cause false alarms and real differences are never hidden.

#### Acceptance Criteria

1. THE comparator SHALL parse Result_Lines from stdout and keep the last value for repeated labels.
2. THE comparator SHALL treat values as numbers when, after removing spaces, a leading `+`, thousands separators and leading zeros, they match `^-?\d+(\.\d+)?$`, and SHALL compare them as exact decimals (no floating point).
3. THE comparator SHALL compare non-numeric values as trimmed strings with internal whitespace collapsed.
4. IF COBOL prints a trailing minus sign (`123.45-`), THEN THE comparator SHALL read it as negative.

### Requirement 5: Python runner limits

**User Story:** As a visitor, I want a runaway Python program to stop, so that my tab does not freeze.

#### Acceptance Criteria

1. THE Python_Runner SHALL run in a Web Worker and SHALL terminate the worker after 10 seconds.
2. THE Python_Runner SHALL cap captured stdout at 64 KB and mark the run as truncated above it.
3. WHEN the worker is terminated, THE Python_Runner SHALL create a fresh worker for the next run.

### Requirement 6: Self-hosted fallback runner

**User Story:** As Douglas, I want my own GnuCOBOL runner on a free host, so that I am not tied to one provider.

#### Acceptance Criteria

1. THE Self_Host_Runner SHALL expose `POST /run` accepting `RunReq` and returning `Run`, protected by a bearer token from an environment variable.
2. THE Self_Host_Runner SHALL compile with `cobc -x` in a temporary directory, run with a 5-second wall-clock limit, and delete the directory afterwards.
3. THE Self_Host_Runner SHALL reject sources over 20 000 characters and run as a non-root user.
4. THE Self_Host_Runner SHALL expose `GET /health` returning the `cobc --version` first line.

### Requirement 7: Stretch spirits

**User Story:** As a learner, I want Fortran and BASIC too, so that I can compare old languages.

#### Acceptance Criteria

1. WHERE the Fortran spirit is enabled, THE Run_API SHALL run Fortran through the same adapters using the adapter's Fortran compiler id.
2. WHERE the BASIC spirit is enabled, THE Run_API SHALL run BASIC through the same adapters using the adapter's BASIC compiler id.
3. THE Run_API SHALL reject a language whose spirit is not enabled with HTTP 400.
