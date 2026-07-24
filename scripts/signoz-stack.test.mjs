import assert from "node:assert/strict";
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
