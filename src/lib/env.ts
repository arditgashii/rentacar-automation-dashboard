import path from "node:path";

// Reads the environment once. Paths are resolved against the folder the app was started from.
function resolveDir(value: string | undefined, fallback: string): string {
  return path.resolve(process.cwd(), value || fallback);
}

const qaRepo = resolveDir(process.env.QA_REPO_PATH, "../rentacar-qa-automation");
const defaultPython =
  process.platform === "win32"
    ? path.join(qaRepo, ".venv", "Scripts", "python.exe")
    : path.join(qaRepo, ".venv", "bin", "python");

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://qahub:qahub-local@localhost:5433/qahub",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  seedPassword: process.env.SEED_PASSWORD ?? "QaHub!2026",
  qaRepo,
  qaPython: process.env.QA_PYTHON || defaultPython,
  platformRepo: resolveDir(process.env.PLATFORM_REPO_PATH, "../rentacar-platform"),
  platformUrl: process.env.PLATFORM_URL ?? "http://localhost:8000",
  platformGithubUrl: process.env.PLATFORM_GITHUB_URL ?? "https://github.com/arditgashii/rentacar-platform",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  storageDir: resolveDir(process.env.STORAGE_DIR, "storage"),
  allowLocalWebhook: process.env.TEAMS_ALLOW_LOCAL_WEBHOOK === "1",
  jiraBaseUrl: process.env.JIRA_BASE_URL ?? "https://jira.example.com/browse/",
  jiraProjectKey: process.env.JIRA_PROJECT_KEY ?? "DN",
  mediaRetentionDays: Number(process.env.MEDIA_RETENTION_DAYS ?? 14),
  secureCookies: process.env.SECURE_COOKIES === "1",
};
