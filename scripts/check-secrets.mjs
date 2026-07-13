import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const checkHistory = process.argv.includes("--history");
const allowedSensitiveNames = new Set([".env.example", "scripts/check-secrets.mjs"]);
const riskyName = /(^|\/)(\.env($|\.)|.*(?:secret|credential|private[-_]?key|cookie).*)/i;
const rules = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["GitHub token", /gh[pousr]_[0-9A-Za-z]{30,}/],
  ["OpenAI-compatible key", /sk-[0-9A-Za-z_-]{20,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/]
];

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const failures = [];

for (const file of tracked) {
  if (riskyName.test(file) && !allowedSensitiveNames.has(file)) {
    failures.push(`${file}: sensitive filename is tracked`);
  }

  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;
  const content = buffer.toString("utf8");
  for (const [name, pattern] of rules) {
    if (pattern.test(content)) failures.push(`${file}: ${name} pattern`);
  }
}

if (checkHistory) {
  const revisions = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" })
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const historyPattern = [
    "AKIA[0-9A-Z]{16}",
    "AIza[0-9A-Za-z_-]{35}",
    "gh[pousr]_[0-9A-Za-z]{30,}",
    "sk-[0-9A-Za-z_-]{20,}",
    "-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"
  ].join("|");

  for (let index = 0; index < revisions.length; index += 100) {
    const result = spawnSync(
      "git",
      ["grep", "-I", "-l", "-E", historyPattern, ...revisions.slice(index, index + 100)],
      { encoding: "utf8" }
    );
    if (result.status !== 0 && result.status !== 1) {
      failures.push("git history scan could not complete");
      break;
    }
    for (const match of result.stdout.trim().split("\n").filter(Boolean)) {
      failures.push(`${match}: secret-like value in history`);
    }
  }
}

if (failures.length) {
  console.error("Secret scan failed:\n" + [...new Set(failures)].join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed for ${tracked.length} tracked files${checkHistory ? " and git history" : ""}.`);
