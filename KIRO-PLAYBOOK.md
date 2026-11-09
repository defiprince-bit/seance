# Séance: Kiro playbook for Douglas

You build the code in Kiro. This pack gives Kiro the specs, steering, hooks, a custom agent and MCP settings to build from. Deadline: **4 Dec 2026, 2:00 pm PT (11:00 pm WAT)**.

## 0. Sign up first (all free, no card)
| What | Why | Where |
|---|---|---|
| Kiro (done) + 4,000 credits form (by 1 Dec, 12:00 pm PT) | the build tool | kiro.dev, credit form from the hackathon page |
| GitHub public repo `seance` | judges need a public repo with MIT LICENSE | github.com/new |
| Groq API key | LLM for summon and narrate (free tier) | console.groq.com |
| OnlineCompiler.io API key | real GnuCOBOL 3.2 runs (free 100,000 runs/month) | api.onlinecompiler.io |
| Vercel (sign in with GitHub) | hosting + `/api` functions (Hobby) | vercel.com |
| Render (later, optional) | your own GnuCOBOL fallback runner | render.com |

Also install **Node.js 22 LTS** and **Git**. The `fetch` MCP server needs **uv** (`uvx`); if you skip uv, set `"disabled": true` for `fetch` in `.kiro/settings/mcp.json`.

Never paste keys into Kiro chat, steering or code. They go into Vercel → Project → Settings → Environment Variables. The `block-secrets` hook will stop Kiro if one slips into a file.

## 1. Set up the repo
1. Create the public GitHub repo `seance`, clone it, and unpack this pack into the repo root so you have `.kiro/`, `design/`, `LICENSE`, `.gitignore` and this file at the top level.
2. Commit: `git add -A && git commit -m "chore: Kiro spec pack, steering, hooks and design"` and push.
3. On GitHub, check the About box shows **MIT license**.

## 2. Open it in Kiro
1. Kiro → Open Folder → the `seance` repo. Trust the workspace when asked (custom agents only load in trusted workspaces).
2. In the Kiro panel, check that you see:
   - **Specs:** `seance-core`, `proof-runner`, `ghost-narrator`
   - **Steering:** `product`, `tech`, `structure`, `seance-design` (always), `cobol-generation` (fileMatch), `cobol-primer` (auto), `demo-day` (manual)
   - **Agent Hooks:** Guard .kiro and LICENSE, Run related tests on save, Block secrets in written files, Log the task and sync docs
   - **Agents:** `cobol-elder`
   - **MCP:** `fetch` connected
3. If a hook doesn't appear, open it and ask Kiro: "Validate this hook file against the current hook schema." Screenshot the result for the write-up.

## 3. First prompt
Open `.kiro/specs/seance-core/requirements.md` and choose **Analyze Requirements**. Fix anything it flags. Then paste this into a new chat:

> #spec:seance-core Read the requirements, design and steering. Before writing any code, tell me (1) anything in requirements.md that conflicts with design.md or the steering, (2) which Correctness Properties you will turn into property-based tests, and (3) your plan for task 1. Don't start task 1 until I say go.

Answer its questions, adjust the spec in Kiro if you agree with its suggestions (that's real spec-driven work judges want to see), then say "go".

## 4. Task order
Run tasks one at a time with **Start task** in `tasks.md`, so you can review each diff.

**MVP first (target: live séance by about 20 Nov)**
1. `seance-core` 1 → 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6
2. `seance-core` 3 (Run API). Test it with the sales program before you move on.
3. `seance-core` 4 → 5 → 6 → 7 → 8
4. `seance-core` 9: deploy to Vercel. Stop and confirm the live agreement bar.

**Hardening (about 20–27 Nov)**
5. `proof-runner` 1 → 5. Use **Run all tasks** for this batch: the tasks are pure library work, and the parallel waves are worth a screenshot.
6. `ghost-narrator` 1 → 5
7. `seance-core` 10 (golden séances), 11, 12, 13, 14, 15

**If time allows (27 Nov–2 Dec)**
8. `proof-runner` 6 (Render fallback runner), then the starred stretch tasks (Fortran/BASIC, Ask about these lines).

**Freeze 3 Dec.** Run `#demo-day` in chat (or `/demo-day`) and work through the checklist.

After a big chunk, switch to the **cobol-elder** agent and ask: "Review src/fixtures/golden/sales.json and the narrate prompt." Paste its verdict into `docs/kiro-log.md`.

## 5. What to capture for "How I used Kiro" (judges score this as 20%)
Make a folder `docs/kiro-shots/` and save screenshots as you go:
- [ ] The Kiro panel showing specs, steering, hooks, agent and MCP all loaded
- [ ] Analyze Requirements results, plus one requirement you changed because of it
- [ ] The design phase showing Correctness Properties linked to requirements
- [ ] A **property-based test failing** with its shrunk counterexample, and the fix (likely candidates: `normalize` with trailing minus, `repairSteps` with overlapping ranges)
- [ ] A task list mid-run with tasks in progress and completed, and a **Run all tasks** wave
- [ ] The `block-secrets` hook blocking a write (try pasting a fake `gsk_…` value into a test file)
- [ ] The `test-on-save` hook reporting a failure back to the agent
- [ ] `docs/kiro-log.md` growing after tasks (written by the PostTaskExecution hook)
- [ ] `cobol-elder` reviewing a golden séance
- [ ] Any vibe-coding moment (a quick chat fix) next to a spec task, for the "spec vs vibe" comparison
- [ ] If you try Kiro CLI or Kiro Web as well, one screenshot each and a note on how they differed

Keep short notes in `docs/kiro-log.md` on what surprised you. Judges reward experimentation, and the Social Blitz prize rewards original thoughts over AI writing, so write those notes in your own words.

**Be upfront:** in the write-up, say the first drafts of the spec and steering were written with an assistant outside Kiro, and that Kiro analyzed, refined and implemented them. Then show the changes Kiro made.

## 6. Submission checklist (Devpost)
- Live Vercel URL that works with no login, plus golden chips that always work
- Public GitHub repo with `.kiro/` committed (the session-start hook checks this) and the MIT LICENSE detected
- YouTube video under 3:00 showing task → COBOL → planchette glide → Python → agreement bar, with no copyrighted music
- Category: **Resurrection**. Optional bonuses: a blog post that mentions Kiroween 2026, and a social post that starts with `#KiroweenHackathon26`
- "How we used Kiro" write-up from `docs/kiro-log.md` + screenshots
