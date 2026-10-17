import fs from "fs";

const path = String.raw`C:\Users\forbi\.cursor\projects\c-Users-forbi-Desktop-ice-cream-site\agent-transcripts\dae5220e-dac7-4ac4-85d6-9ebcf75c3453\dae5220e-dac7-4ac4-85d6-9ebcf75c3453.jsonl`;
const lines = fs.readFileSync(path, "utf8").split(/\n/);
for (let i = 133; i <= 165; i++) {
  const line = lines[i - 1];
  if (!line) {
    console.log("---", i, "missing");
    continue;
  }
  const j = JSON.parse(line);
  const c = j.message?.content;
  console.log("\n==== LINE", i, j.role, "====");
  if (!Array.isArray(c)) continue;
  for (const p of c) {
    if (p.type === "text") console.log("TEXT:", p.text.slice(0, 800));
    if (p.type === "tool_use" && p.name === "StrReplace") {
      console.log("FILE:", p.input.path);
      console.log("OLD:\n", p.input.old_string.slice(0, 900));
      console.log("NEW:\n", p.input.new_string.slice(0, 1200));
    } else if (p.type === "tool_use") {
      console.log("TOOL:", p.name);
    }
  }
}
