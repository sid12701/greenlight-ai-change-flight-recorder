import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  expectedImages,
  parseImageEnv,
  validatePins,
  validateStackPins,
} from "./signoz-stack.mjs";

test("production Foundry and runtime image pins agree", async () => {
  const values = await validateStackPins();
  assert.equal(values.size, Object.keys(expectedImages).length);
});

test("validator rejects mutable and mismatched image pins", () => {
  const validValues = () =>
    new Map(
      Object.entries(expectedImages).map(([key, image]) => [
        key,
        `${image}@sha256:${"a".repeat(64)}`,
      ]),
    );
  const casting = Object.values(expectedImages)
    .map((image) => `image: ${image}`)
    .join("\n");
  validatePins(casting, validValues());

  const mutable = validValues();
  mutable.set("SIGNOZ_IMAGE", "signoz/signoz:latest");
  assert.throws(() => validatePins(casting, mutable), /must pin/);
  assert.throws(
    () =>
      validatePins(
        `${casting}\nimage: example/tool:latest`,
        validValues(),
      ),
    /contain a latest image/,
  );
  assert.throws(
    () => validatePins(`${casting}\nversion: latest`, validValues()),
    /contain a latest version/,
  );
});

test("image env parser ignores comments and rejects malformed lines", () => {
  assert.deepEqual(
    [...parseImageEnv("# pins\nA=image@sha256:abc\n").entries()],
    [["A", "image@sha256:abc"]],
  );
  assert.throws(() => parseImageEnv("missing-separator"), /invalid image env/);
});

test("Foundry version checks cannot fail from grep closing a pipe early", () => {
  for (const script of ["preflight.sh", "signoz-runtime-verify.sh"]) {
    const source = readFileSync(join(import.meta.dirname, script), "utf8");
    assert.doesNotMatch(source, /foundryctl version 2>&1\s*\|\s*grep -q/);
    assert.match(source, /FOUNDRY_VERSION_OUTPUT=/);
  }
});

test("runtime verification allows the collector to become ready", () => {
  const source = readFileSync(
    join(import.meta.dirname, "signoz-runtime-verify.sh"),
    "utf8",
  );
  assert.match(source, /OTLP_READY=0/);
  assert.match(source, /for _ in \$\(seq 1 12\)/);
  assert.match(source, /SMOKE_EXPORT_TIMEOUT_MS=3000/);
  assert.match(source, /OTLP_READY=1/);
  assert.match(source, /did not become ready within 60 seconds/);
});
