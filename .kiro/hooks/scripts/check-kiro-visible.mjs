// Kiroween rule: the /.kiro directory must be committed and NOT gitignored,
// and the repo needs an open-source LICENSE. Exit 1 sends stderr to the agent.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const problems = [];
const probes = [".kiro", ".kiro/steering/product.md", ".kiro/specs/seance-core/tasks.md", ".kiro/hooks/guard-kiro-folder.json"];

let inGit = true;
try { execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" }); } catch { inGit = false; }

if (inGit) {
  for (const p of probes) {
    try {
      execSync(`git check-ignore -q --no-index "${p}"`, { stdio: "ignore" });
      problems.push(`${p} is matched by .gitignore. Remove that rule: an ignored .kiro folder can disqualify the Kiroween entry.`);
    } catch { /* exit 1 = not ignored, which is what we want */ }
  }
} else {
  problems.push("This folder is not a git repo yet. Run `git init` so the .kiro folder can be committed.");
}
if (!existsSync("LICENSE")) problems.push("LICENSE is missing. Kiroween requires an open-source license detectable by GitHub (MIT is in the pack).");

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(".kiro is tracked and LICENSE exists.");
