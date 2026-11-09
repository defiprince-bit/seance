// PreToolUse guard: reads the hook event JSON from stdin and blocks the write
// (non-zero exit) if the tool input looks like it contains a real secret.
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let text = raw;
  try { text = JSON.stringify(JSON.parse(raw).tool_input ?? JSON.parse(raw)); } catch { /* scan raw text */ }
  const patterns = [
    [/gsk_[A-Za-z0-9]{20,}/, "Groq API key"],
    [/sk-[A-Za-z0-9_-]{20,}/, "OpenAI-style secret key"],
    [/AIza[0-9A-Za-z_-]{30,}/, "Google API key"],
    [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, "GitHub token"],
    [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
    [/(ONLINECOMPILER_API_KEY|LLM_API_KEY|SELFHOST_RUNNER_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_\-]{16,}/, "env secret value"],
  ];
  const hit = patterns.find(([re]) => re.test(text));
  if (hit) {
    console.error(`Blocked: this write looks like it contains a ${hit[1]}. Put secrets in Vercel environment variables and reference them with process.env. Use obviously fake values in tests.`);
    process.exit(2);
  }
  process.exit(0);
});
