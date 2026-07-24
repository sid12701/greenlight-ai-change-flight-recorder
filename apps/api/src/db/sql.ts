/**
 * One source of SQL, two placeholder dialects.
 *
 * `node:sqlite` binds named parameters as `@name`; `pg` binds positional
 * parameters as `$1`. Writing every statement twice would guarantee the two
 * copies drift, so statements are authored once with `:name` placeholders and
 * translated per driver at prepare time.
 */

export type SqlParameters = Record<string, string | number | null>;

// The negative lookbehind keeps PostgreSQL `::type` casts from being read as
// placeholders, which would silently corrupt any statement containing one.
const PLACEHOLDER = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g;

export interface PositionalStatement {
  text: string;
  /** Parameter names in the order the driver expects them. */
  names: string[];
}

/**
 * Rewrites `:name` placeholders to `$1`-style positional parameters.
 *
 * A name used more than once reuses its position rather than being bound
 * twice, which keeps the parameter list aligned with the statement.
 */
export function toPositional(sql: string): PositionalStatement {
  const names: string[] = [];
  const text = sql.replace(PLACEHOLDER, (_match, name: string) => {
    const existing = names.indexOf(name);
    if (existing !== -1) {
      return `$${existing + 1}`;
    }
    names.push(name);
    return `$${names.length}`;
  });
  return { text, names };
}

/** Rewrites `:name` placeholders to the `@name` form `node:sqlite` binds. */
export function toNamed(sql: string): string {
  return sql.replace(PLACEHOLDER, (_match, name: string) => `@${name}`);
}

/** Orders a parameter object into the positional array a driver expects. */
export function bindPositional(
  statement: PositionalStatement,
  parameters: SqlParameters,
): Array<string | number | null> {
  return statement.names.map((name) => {
    const value = parameters[name];
    return value === undefined ? null : value;
  });
}
