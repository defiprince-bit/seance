# Design Document: proof-runner

## Overview
All execution goes through one interface so the UI never knows which provider ran the code.

```ts
interface RunnerAdapter { name: Run['runner']; supports(lang: RunReq['language']): boolean; run(req: RunReq): Promise<Run> }
```

| Adapter | Where | Cost | Notes |
|---|---|---|---|
| `onlinecompiler` | `server/runners/onlinecompiler.ts` | Free tier: 100,000 runs/month, no card | `POST https://api.onlinecompiler.io/api/run-code-sync/`, header `Authorization: <key>`, body `{ compiler, code, input }`. COBOL id `gnucobol-3.2` (compiled `cobc -x -free …`), Fortran `gfortran-15`, FreeBASIC `fbc-1.10`. Verify ids at `GET /api/compilers/` before relying on them. Key stays server-side. |
| `selfhost` | `runner/` folder (Docker) deployed to Render free web service | Free: 750 instance hours/month, spins down after 15 min idle (about 1 min cold start) | `debian:stable-slim` + `gnucobol` apt package, tiny Node HTTP server. |
| `fixtures` | `server/runners/fixtures.ts` | Free | Replays stored runs for golden sources only (by SHA-256). |

### Fixed-format directive
The hosted runner compiles in free format, so the adapter sends `">>SOURCE FORMAT IS FIXED\n" + source` and remaps messages with offset 1. The self-host runner can call `cobc -x -fixed` (no directive, offset 0). The adapter returns the offset it used so the remapper is shared.

### Stdin protocol
```
<N>\n
<row 1>\n
…
<row N>\n
```
COBOL reads N with `ACCEPT WS-COUNT`, then `PERFORM N TIMES` with `ACCEPT WS-LINE`. This avoids EOF handling, which differs between COBOL dialects. Python reads `int(sys.stdin.readline())` then N lines.

### Comparator
`parseResultLines → Map<label, raw>` → `normalize(raw)`: strip spaces and `+`, move a trailing `-` to the front, remove `,`, strip leading zeros (keep one before `.`), drop trailing fractional zeros. Compare normalized strings, which is exact decimal comparison without floats.

### Self-host runner (outline only; Douglas builds it with Kiro)
```
runner/
├─ Dockerfile        # FROM debian:stable-slim; apt-get install gnucobol nodejs; USER 1000
├─ server.mjs        # POST /run, GET /health; spawn cobc with timeout; tmp dir per request
└─ README.md         # Render deploy steps
```

## Correctness Properties

**Property 1: Stdin round-trip**
*For any* list of CSV rows without embedded newlines and any header, `decodeStdin(encodeStdin(header + rows))` equals `rows`, and the first line equals `rows.length`.
**Validates: Requirements 2.1, 2.2, 2.4**

**Property 2: Line remap is an offset, clamped**
*For any* compiler message with line `L` and offset `k`, the remapped line is `max(1, L − k)`; text other than the line number is unchanged.
**Validates: Requirements 3.1, 3.2**

**Property 3: Normalization is idempotent**
*For any* string `x`, `normalize(normalize(x)) === normalize(x)`.
**Validates: Requirements 4.2, 4.3**

**Property 4: Padding never matters, value always does**
*For any* decimal `v` and any padding (leading spaces, leading zeros, `+`, trailing fractional zeros), padded forms normalize equal; *for any* `v ≠ w`, their forms normalize different.
**Validates: Requirements 4.2, 4.4**

**Property 5: Fallback only on infrastructure errors**
*For any* sequence of adapter outcomes, the chain returns the first outcome that is not 429/5xx/network error, and never skips a compile error.
**Validates: Requirements 1.2, 1.3**

## Error Handling
- All adapter errors become `Run` or typed `RunnerUnavailable`. The API returns 503 only when the whole chain is unavailable.
- Self-host cold start: the client shows "Waking the spirits…" if a run takes more than 4 seconds.

## Testing Strategy
- fast-check for Properties 1–5 (adapters mocked with generated outcome sequences for Property 5).
- Contract test per adapter with recorded responses (no live calls in CI).
- A manual `npm run runner:ping` script that runs the golden sales program against every configured adapter and prints the runner name and result line.
