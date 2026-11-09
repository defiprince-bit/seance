# Implementation Plan

- [ ] 1. Stdin protocol hardening
- [ ] 1.1 Finalize `src/lib/stdin.ts` (header drop, CRLF → LF, `0\n` when empty)
  - _Requirements: 2.1, 2.2, 2.3_
- [ ] 1.2 Property test: stdin round-trip (Property 1)
  - _Requirements: 2.1, 2.2, 2.4_

- [ ] 2. Compiler message remapping
- [ ] 2.1 Finalize `src/lib/lineOffset.ts` and `compileError` extraction
  - _Requirements: 3.1, 3.2, 3.3_
- [ ] 2.2 Property test: remap offset and clamp (Property 2)
  - _Requirements: 3.1, 3.2_

- [ ] 3. Comparator hardening
- [ ] 3.1 Implement `normalize` with trailing-minus, separators, leading/trailing zeros
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
- [ ] 3.2 Property tests: idempotence and padding vs value (Properties 3, 4)
  - _Requirements: 4.2, 4.3, 4.4_

- [ ] 4. Runner chain
- [ ] 4.1 `server/runners/chain.ts` builds the chain from env and falls back on 429/5xx/network only
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [ ] 4.2 Property test: fallback only on infrastructure errors (Property 5)
  - _Requirements: 1.2, 1.3_
- [ ] 4.3 `server/runners/fixtures.ts` answers only for golden source hashes
  - _Requirements: 1.5_

- [ ] 5. Python runner limits
  - 10 s terminate-and-respawn, 64 KB stdout cap with `truncated`
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. Self-hosted GnuCOBOL runner
- [ ] 6.1 `runner/Dockerfile` and `runner/server.mjs` (`POST /run`, `GET /health`, bearer token, tmp dir, 5 s limit, non-root)
  - _Requirements: 6.1, 6.2, 6.3, 6.4_
- [ ] 6.2 `server/runners/selfhost.ts` adapter
  - _Requirements: 1.1, 6.1_
- [ ] 6.3 Deploy to Render free web service and set `SELFHOST_RUNNER_URL` / `SELFHOST_RUNNER_TOKEN` in Vercel
  - Checkpoint: ask the user to confirm `GET /health` shows a GnuCOBOL version
  - _Requirements: 6.4_

- [ ]* 7. Stretch: Fortran and BASIC spirits
  - Enable in picker, add compiler ids to adapters, add one golden séance each
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]* 8. Stretch: browser-only COBOL for golden séances
  - Precompile the golden COBOL sources to WebAssembly in a GitHub Action (GnuCOBOL → C → Emscripten, following cloudflare/cobweb or moxon6/cobol-js-emscripten) and run them in the browser when offline. Only claim "runs in your browser" for these if it ships.
  - _Requirements: 1.5_
