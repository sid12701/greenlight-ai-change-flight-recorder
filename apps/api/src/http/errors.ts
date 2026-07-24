/**
 * Typed application errors.
 *
 * Every error carries the machine-readable facts a caller needs — a stable
 * code, an HTTP status, whether retrying can help, and when — so that no
 * consumer has to parse a human-readable message to decide what to do.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AppError";
  }

  /**
   * The earliest time a retry could succeed, when that is known.
   * `undefined` means "no earlier bound"; schedulers fall back to backoff.
   */
  get retryAt(): string | undefined {
    return undefined;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("validation_error", message, 400);
    this.name = "ValidationError";
  }
}

export class DependencyError extends AppError {
  constructor(code: string, message: string, retryable = true) {
    super(code, message, 503, retryable);
    this.name = "DependencyError";
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
    this.name = "ConflictError";
  }
}

/**
 * A conflict that resolves on its own at a known future time — an evaluation
 * window that has not elapsed yet, for example.
 *
 * The deadline is a field rather than something embedded in the message, so a
 * scheduler reads it directly instead of pattern-matching prose.
 */
export class RetryAfterError extends AppError {
  constructor(
    code: string,
    message: string,
    private readonly notBefore: string,
  ) {
    super(code, `${message} (not before ${notBefore})`, 409, true);
    this.name = "RetryAfterError";
  }

  override get retryAt(): string {
    return this.notBefore;
  }
}
