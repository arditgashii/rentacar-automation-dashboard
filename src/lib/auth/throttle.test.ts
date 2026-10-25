import { describe, expect, it } from "vitest";

import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from "./throttle";

describe("login throttle", () => {
  it("lets four wrong passwords through and stops the fifth until the window ends", () => {
    const throttle = new LoginThrottle();
    const start = 1_000_000;
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.failed("a@x.test", start + i);
    expect(throttle.waitFor("a@x.test", start + 10)).toBe(0);
    throttle.failed("a@x.test", start + 20);
    expect(throttle.waitFor("a@x.test", start + 30)).toBe(WINDOW_MS - 30);
    expect(throttle.waitFor("b@x.test", start + 30)).toBe(0);
    expect(throttle.waitFor("a@x.test", start + WINDOW_MS)).toBe(0);
  });

  it("forgets the failures after a successful login", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_FAILURES; i++) throttle.failed("a@x.test", i);
    throttle.succeeded("a@x.test");
    expect(throttle.waitFor("a@x.test", 10)).toBe(0);
  });
});
