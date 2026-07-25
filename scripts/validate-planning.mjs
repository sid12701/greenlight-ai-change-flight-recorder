import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

const required = [
  "README.md",
  "PROVENANCE.md",
  "planning/archive/GREENLIGHT_IMPLEMENTATION_PLAN.md",
  "planning/archive/TASKS.yaml",
  "docs/IMPLEMENTATION_TASKS.md",
  "docs/DEPENDENCY_GRAPH.md",
  "docs/TEST_STRATEGY.md",
  "docs/COMMIT_STRATEGY.md",
  "docs/OPEN_DECISIONS.md",
  "planning/issues-index.json",
  "planning/labels.yml",
  "planning/milestones.yml",
];

for (const file of required) {
  if (!exists(file)) throw new Error(`Missing required file: ${file}`);
}

const issues = JSON.parse(read("planning/issues-index.json"));
if (issues.length !== 30) throw new Error(`Expected 30 issues, found ${issues.length}`);
if (new Set(issues.map((x) => x.id)).size !== issues.length) throw new Error("Duplicate issue IDs");
for (const issue of issues) {
  if (!exists(issue.body_file)) throw new Error(`Missing issue body: ${issue.body_file}`);
  const body = read(issue.body_file);
  for (const heading of ["## Outcome", "## Verification contract", "## Implementation steps", "## Acceptance criteria", "## Required evidence for closure", "## Fallback / pivot", "## Suggested atomic commit"]) {
    if (!body.includes(heading)) throw new Error(`${issue.id} missing ${heading}`);
  }
}

const generated = read("docs/IMPLEMENTATION_TASKS.md");
for (const issue of issues) {
  if (!generated.includes(`# ${issue.id} —`)) throw new Error(`Task index missing ${issue.id}`);
}

const allText = required.concat(issues.map((x) => x.body_file)).map(read).join("\n");
const forbidden = [
  /gho_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,
];
for (const pattern of forbidden) {
  if (pattern.test(allText)) throw new Error(`Potential secret matched ${pattern}`);
}

if (!read("README.md").includes("AI assistance disclosure")) throw new Error("README lacks AI disclosure");
if (!read("PROVENANCE.md").includes("Pre-existing work")) throw new Error("PROVENANCE lacks pre-existing work");
if (!read("docs/COMMIT_STRATEGY.md").includes("sid12701")) throw new Error("Commit identity is not sid12701");
if ((read("planning/archive/TASKS.yaml").match(/priority: p1/g) ?? []).length !== 3) throw new Error("Expected exactly three pre-declared P1 sacrifice tasks");
if ((read("planning/archive/TASKS.yaml").match(/verification: strict_tdd/g) ?? []).length !== 10) throw new Error("Expected ten strict-TDD logic tasks");
if (!read("docs/DEPENDENCY_GRAPH.md").includes("incident tuning begins as soon as the evaluator is ready")) throw new Error("Dependency graph does not expose the Phase 6/UI overlap");

const configValidation = spawnSync(process.execPath, ["scripts/validate-config-contract.mjs"], {
  cwd: root,
  encoding: "utf8",
});
if (configValidation.status !== 0) {
  throw new Error(configValidation.stderr || configValidation.stdout || "Config contract validation failed");
}

console.log(`Planning validation passed: ${issues.length} unique tracer-bullet issues.`);
