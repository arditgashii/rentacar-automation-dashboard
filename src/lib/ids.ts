import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** `newId("run")` -> `run_k3x9a0m2qz`. Short, readable, safe in URLs. */
export function newId(prefix: string): string {
  const bytes = randomBytes(10);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${id}`;
}

const ID = /^[a-z]{3}_[0-9a-z]{10}$/;

/** True only for ids this app creates, so "../" or anything odd never reaches a query or a path. */
export function isId(value: unknown, prefix?: string): value is string {
  return typeof value === "string" && ID.test(value) && (!prefix || value.startsWith(`${prefix}_`));
}
