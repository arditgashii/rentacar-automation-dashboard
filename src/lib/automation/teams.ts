// Microsoft Teams: templates, placeholders and workflow links. Pure functions, used by the settings
// page (preview, validation) and by the worker (the real messages).

export type TemplateKind = "results" | "bug";

export type Placeholder = { name: string; description: string };

export const PLACEHOLDERS: Record<TemplateKind, Placeholder[]> = {
  results: [
    { name: "status", description: "Passed, Failed, Stopped or Not ready" },
    { name: "name", description: "Name of the run or schedule" },
    { name: "total", description: "Number of tests" },
    { name: "passed", description: "Passed tests (flaky included)" },
    { name: "failed", description: "Failed tests, known bugs left out" },
    { name: "flaky", description: "Tests that passed on a retry" },
    { name: "knownBugs", description: "Tests that failed on a known bug" },
    { name: "skipped", description: "Skipped tests" },
    { name: "duration", description: "How long the run took" },
    { name: "schedule", description: "The schedule in words" },
    { name: "commit", description: "Short platform commit the run tested" },
    { name: "failedTests", description: "One line per failed test" },
    { name: "link", description: "Link to the run in the dashboard" },
  ],
  bug: [
    { name: "title", description: "Bug title" },
    { name: "testCase", description: "Test case ID, for example TC-005" },
    { name: "failureType", description: "Product bug, Test issue, Environment or Known bug" },
    { name: "description", description: "What went wrong, in plain words" },
    { name: "steps", description: "Numbered steps of the test" },
    { name: "expected", description: "What should have happened" },
    { name: "actual", description: "What happened instead" },
    { name: "commits", description: "Platform commits since the test last passed" },
    { name: "schedule", description: "The schedule in words" },
    { name: "link", description: "Link to the run in the dashboard" },
  ],
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, string> = {
  results: [
    "{{status}}: {{name}}",
    "{{passed}} of {{total}} passed, {{failed}} failed, {{flaky}} flaky, {{knownBugs}} known bugs, {{skipped}} skipped",
    "{{schedule}} | {{duration}} | commit {{commit}}",
    "",
    "{{failedTests}}",
    "",
    "Open the run: {{link}}",
  ].join("\n"),
  bug: [
    "Bug: {{title}}",
    "Test case {{testCase}} | {{failureType}}",
    "",
    "{{description}}",
    "",
    "Steps:",
    "{{steps}}",
    "",
    "Expected: {{expected}}",
    "Actual: {{actual}}",
    "",
    "Commits since it last passed:",
    "{{commits}}",
    "",
    "Run: {{link}}",
  ].join("\n"),
};

const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Problems that block Save, or an empty list. */
export function validateTemplate(kind: TemplateKind, template: string): string[] {
  const problems: string[] = [];
  const firstLine = template.split("\n")[0]?.trim() ?? "";
  if (!firstLine) problems.push("The first line is the title of the message and cannot be empty.");
  const known = new Set(PLACEHOLDERS[kind].map((p) => p.name));
  const unknown = [...template.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((name) => !known.has(name));
  for (const name of [...new Set(unknown)]) problems.push(`Unknown placeholder {{${name}}}.`);
  return problems;
}

/**
 * Fills the placeholders. A paragraph (lines between blank lines) whose placeholders are all empty is
 * left out, so a run without failures has no empty "failed tests" block.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  const paragraphs = template.split(/\n\s*\n/);
  const kept = paragraphs
    .map((paragraph) => {
      const names = [...paragraph.matchAll(PLACEHOLDER)].map((m) => m[1]);
      if (names.length > 0 && names.every((name) => !values[name])) return null;
      return paragraph.replace(PLACEHOLDER, (_, name: string) => values[name] ?? "");
    })
    .filter((paragraph): paragraph is string => paragraph !== null);
  return kept.join("\n\n").trim();
}

const TEAMS_HOSTS = [/\.webhook\.office\.com$/i, /\.logic\.azure\.com$/i, /\.powerplatform\.com$/i, /\.powerautomate\.com$/i];

/** Only Teams and Power Automate workflow links (and localhost when allowed for local checks). */
export function isTeamsWebhook(value: string, allowLocal: boolean): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (allowLocal && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return true;
  return url.protocol === "https:" && TEAMS_HOSTS.some((host) => host.test(url.hostname));
}

/** The only part of a link the browser ever sees: "...abc123". */
export function maskWebhook(value: string): string {
  return `...${value.slice(-6)}`;
}
