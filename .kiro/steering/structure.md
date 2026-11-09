---
inclusion: always
---

# Project structure

```
/
├─ .kiro/                 # specs, steering, hooks, agents, MCP settings (NEVER gitignored)
├─ design/                # UI/UX pack: mocks/*.html are the visual source of truth
├─ api/                   # Vercel Functions (server only)
│  ├─ summon.ts           # POST task -> COBOL program (LLM)
│  ├─ narrate.ts          # POST numbered COBOL -> steps + Python lines (LLM)
│  └─ run.ts              # POST COBOL source + stdin -> Run (runner adapter)
├─ server/                # server-only modules imported by api/*
│  ├─ llm/                # provider adapter + prompts
│  └─ runners/            # onlinecompiler.ts, selfhost.ts, fixtures.ts
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ components/         # one component per file, names from seance-design.md
│  ├─ lib/                # PURE logic, fully unit + property tested
│  │  ├─ ranges.ts        # range intersection, step validation
│  │  ├─ stdin.ts         # stdin protocol encode/decode
│  │  ├─ results.ts       # RESULT line parsing + agreement comparison
│  │  ├─ lineOffset.ts    # compiler message line remapping
│  │  └─ schemas.ts       # zod schemas shared by client and server
│  ├─ services/           # fetch wrappers for our /api + Pyodide worker client
│  ├─ workers/pyodide.worker.ts
│  ├─ fixtures/golden/    # cached golden séances for the suggestion chips
│  └─ styles/tokens.css, motion.css, base.css
├─ tests/                 # *.test.ts and *.property.test.ts mirror src/lib
├─ docs/
│  ├─ kiro-log.md         # appended by the docs hook after each spec task
│  └─ how-we-used-kiro.md # write-up draft for Devpost
├─ README.md, LICENSE (MIT), .env.example, .gitignore
```

## Conventions
- Files: `camelCase.ts` for lib/services, `PascalCase.tsx` for components.
- Tests: `tests/<module>.test.ts` (examples) and `tests/<module>.property.test.ts` (fast-check). Each property test starts with a comment `// Property N: <name> — Validates: Requirements X.Y`.
- Imports: `src/lib` must not import from `src/components`, `src/services` or `api/`.
- Shared types come from `src/lib/schemas.ts` (zod `infer`), never duplicated.
- Line numbers are **1-based** everywhere (UI, ranges, compiler messages).
