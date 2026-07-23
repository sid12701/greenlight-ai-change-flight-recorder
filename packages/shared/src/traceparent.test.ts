import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractAiTraceparentFromMessage,
  formatTraceparent,
  parseTraceparent,
} from "./traceparent.js";

const vectors = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../test-vectors/traceparent.json"),
    "utf8",
  ),
);

describe("parseTraceparent", () => {
  for (const vector of vectors.accepted) {
    it(`accepts ${vector.id}`, () => {
      const result = parseTraceparent(vector.input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(vector.expected);
        expect(formatTraceparent(result.value)).toBe(
          `${vector.expected.version}-${vector.expected.traceId}-${vector.expected.spanId}-${vector.expected.flags}`,
        );
      }
    });
  }

  for (const vector of vectors.rejected) {
    it(`rejects ${vector.id}`, () => {
      const result = parseTraceparent(vector.input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(vector.code);
        if (vector.input) {
          expect(result.message).not.toContain(vector.input);
        }
      }
    });
  }
});

describe("extractAiTraceparentFromMessage", () => {
  for (const vector of vectors.trailer.accepted) {
    it(`extracts trailer ${vector.id}`, () => {
      const result = extractAiTraceparentFromMessage(vector.message);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(formatTraceparent(result.value)).toBe(vector.expected);
      }
    });
  }

  for (const vector of vectors.trailer.rejected) {
    it(`rejects trailer ${vector.id}`, () => {
      const result = extractAiTraceparentFromMessage(vector.message);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe(vector.code);
      }
    });
  }
});
