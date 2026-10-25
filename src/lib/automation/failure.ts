import type { FailureType } from "./types";

/**
 * The failure type of a failed test, from what the pytest plugin saw:
 * a known bug first, then an unreachable environment, then a broken test, else a product bug.
 */
export function failureTypeOf(test: { knownBug: string | null; errorType: string | null }): FailureType {
  if (test.knownBug) return "known_bug";
  if (test.errorType === "environment" || test.errorType === "setup") return "environment";
  if (test.errorType === "timeout" || test.errorType === "code") return "test";
  return "product";
}

/** A short, readable first line of an error, without assertion internals. */
export function firstLine(message: string | null | undefined, max = 200): string {
  const line = (message ?? "").split("\n").find((part) => part.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}...` : line;
}
