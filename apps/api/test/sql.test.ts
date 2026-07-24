import { describe, expect, it } from "vitest";
import { bindPositional, toNamed, toPositional } from "../src/db/sql.js";

describe("sql dialect translation", () => {
  it("rewrites named placeholders to positional parameters", () => {
    const statement = toPositional("INSERT INTO t (a, b) VALUES (:a, :b)");
    expect(statement.text).toBe("INSERT INTO t (a, b) VALUES ($1, $2)");
    expect(statement.names).toEqual(["a", "b"]);
  });

  it("reuses a position when a parameter appears more than once", () => {
    // Binding the same value twice would misalign every later parameter.
    const statement = toPositional("SELECT * FROM t WHERE a = :a OR b = :a OR c = :c");
    expect(statement.text).toBe("SELECT * FROM t WHERE a = $1 OR b = $1 OR c = $2");
    expect(statement.names).toEqual(["a", "c"]);
    expect(bindPositional(statement, { a: 1, c: 2 })).toEqual([1, 2]);
  });

  it("binds a missing parameter as null rather than undefined", () => {
    // Drivers reject `undefined`; a declared-optional column must bind null.
    const statement = toPositional("INSERT INTO t (a, b) VALUES (:a, :b)");
    expect(bindPositional(statement, { a: "x" } as never)).toEqual(["x", null]);
  });

  it("rewrites named placeholders to the sqlite form", () => {
    expect(toNamed("INSERT INTO t (a) VALUES (:a)")).toBe("INSERT INTO t (a) VALUES (@a)");
  });

  it("leaves casts and time literals untouched", () => {
    // `::text` and `12:30` must not be mistaken for placeholders.
    expect(toPositional("SELECT a::text FROM t").text).toBe("SELECT a::text FROM t");
  });
});
