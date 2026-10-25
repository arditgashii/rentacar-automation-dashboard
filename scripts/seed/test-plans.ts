// Demo data for Test Plans: the DriveNow project with suites that mirror the QA repo, one test case per
// automated test (read from the QA repo's docs/TEST-CASES.md) and some manual test cases.

import fs from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { readCatalog } from "@/lib/automation/state";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";

type Steps = { action: string; expected: string }[];
type Case = { title: string; folder: string; priority: "low" | "medium" | "high" | "critical"; state: "draft" | "active"; type: string; tags: string[]; preconditions?: string; steps: Steps };

// suite -> folder path; a "/" makes a nested folder
const TREE: Record<string, string[]> = {
  Authentication: ["Login", "Logout", "Invalid login", "Registration"],
  Fleet: ["Cars/Create", "Cars/Update", "Cars/Search", "Cars/Delete", "Cars/Generate description", "Photos"],
  Bookings: ["Booking/Create", "Booking/Manage"],
  "Admin portal": ["Users", "Dashboard"],
};

// QA repo folder (module/feature) -> Test Plans folder
const AUTOMATED_FOLDER: Record<string, string> = {
  "authentication/login": "Authentication/Login",
  "authentication/logout": "Authentication/Logout",
  "authentication/invalid-login": "Authentication/Invalid login",
  "authentication/registration": "Authentication/Registration",
  "fleet/cars/create": "Fleet/Cars/Create",
  "fleet/cars/update": "Fleet/Cars/Update",
  "fleet/cars/search": "Fleet/Cars/Search",
  "fleet/cars/delete": "Fleet/Cars/Delete",
  "fleet/cars/generate-description": "Fleet/Cars/Generate description",
  "bookings/booking/create": "Bookings/Booking/Create",
};

const MANUAL: Case[] = [
  { title: "Registering with an email that already exists shows an error", folder: "Authentication/Registration", priority: "medium", state: "active", type: "functional", tags: ["registration"], steps: [{ action: "Open Sign up and enter client1@drivenow.test", expected: "The form opens" }, { action: "Fill the other fields and submit", expected: '"An account with this email already exists." under the email field' }] },
  { title: "A password shorter than 8 characters is refused", folder: "Authentication/Registration", priority: "medium", state: "active", type: "functional", tags: ["registration", "validation"], steps: [{ action: "Sign up with the password 1234567", expected: "The form stays open with an error on the password" }] },
  { title: "A photo larger than 5 MB is refused", folder: "Fleet/Photos", priority: "high", state: "active", type: "functional", tags: ["photos", "upload"], preconditions: "A client with one listed car", steps: [{ action: "Open the car's edit page and upload a 6 MB JPG", expected: '"A photo can be at most 5 MB." and the photo list is unchanged' }] },
  { title: "A text file renamed to .jpg is refused", folder: "Fleet/Photos", priority: "high", state: "active", type: "functional", tags: ["photos", "security"], steps: [{ action: "Upload notes.txt renamed to car.jpg", expected: '"The file is not a readable image."' }] },
  { title: "The owner can reorder photos and pick the main photo", folder: "Fleet/Photos", priority: "medium", state: "active", type: "ui", tags: ["photos"], preconditions: "A car with 3 photos", steps: [{ action: "Move the third photo up twice", expected: "It becomes the first photo" }, { action: "Click Make main on it", expected: "The Main photo badge moves to it and the car card shows it" }] },
  { title: "Filters keep their values after searching", folder: "Fleet/Cars/Search", priority: "low", state: "active", type: "ui", tags: ["search"], steps: [{ action: "Choose city Peja, type SUV, max price 80 and apply", expected: "The results match and every filter keeps its value" }] },
  { title: "The car list shows 12 cars per page", folder: "Fleet/Cars/Search", priority: "low", state: "draft", type: "ui", tags: ["search", "pagination"], steps: [{ action: "Open Browse cars without filters", expected: "12 cards and a Next link when there are more than 12 cars" }] },
  { title: "The booking total updates when the dates change", folder: "Bookings/Booking/Create", priority: "medium", state: "active", type: "ui", tags: ["booking"], steps: [{ action: "Open a car at 45.50 per day and pick 3 days", expected: '"€136.50 for 3 days"' }, { action: "Change the return date to 5 days", expected: '"€227.50 for 5 days"' }] },
  { title: "A client cancels a pending booking", folder: "Bookings/Booking/Manage", priority: "high", state: "active", type: "functional", tags: ["booking"], steps: [{ action: "Open My bookings and cancel a pending booking", expected: "A confirmation dialog appears" }, { action: "Confirm", expected: "The booking shows Cancelled" }] },
  { title: "An admin confirms a pending booking", folder: "Bookings/Booking/Manage", priority: "high", state: "active", type: "functional", tags: ["booking", "admin"], steps: [{ action: "Open Admin > Bookings and click Confirm on a pending booking", expected: '"Booking confirmed." and the status is Confirmed' }] },
  { title: "An admin deactivates a client", folder: "Admin portal/Users", priority: "high", state: "active", type: "functional", tags: ["admin", "users"], steps: [{ action: "Open Admin > Users and click Deactivate on a client", expected: "The status shows Inactive" }, { action: "Log in as that client", expected: '"This account is deactivated."' }] },
  { title: "An admin cannot demote themselves", folder: "Admin portal/Users", priority: "medium", state: "active", type: "functional", tags: ["admin", "users"], steps: [{ action: "Look at your own row in Admin > Users", expected: 'No actions, only "You"' }] },
  { title: "The dashboard tiles match the data", folder: "Admin portal/Dashboard", priority: "medium", state: "active", type: "regression", tags: ["admin"], steps: [{ action: "Count the available cars in Admin > Cars", expected: "The Cars tile shows the same number" }] },
  { title: "The mobile menu opens and closes", folder: "Admin portal/Dashboard", priority: "low", state: "draft", type: "ui", tags: ["mobile"], steps: [{ action: "Open the site at 390 px wide and tap Menu", expected: "The links appear" }, { action: "Tap a link", expected: "The page opens and the menu closes" }] },
  { title: "Notifications are written after a booking", folder: "Bookings/Booking/Create", priority: "medium", state: "draft", type: "api", tags: ["booking", "notifications"], steps: [{ action: "Book a car as client 2", expected: "201" }, { action: "GET /api/v1/notifications as the owner", expected: "A booking.created notification for that booking" }] },
];

/** Test cases from the QA repo's docs/TEST-CASES.md: "## TC-xxx Title", preconditions and the steps table. */
function automatedCases(): Map<string, { title: string; preconditions: string; steps: Steps }> {
  const file = path.join(env.qaRepo, "docs", "TEST-CASES.md");
  const cases = new Map<string, { title: string; preconditions: string; steps: Steps }>();
  if (!fs.existsSync(file)) return cases;
  const sections = fs.readFileSync(file, "utf8").split(/^## /m).slice(1);
  for (const section of sections) {
    const match = /^(TC-\d+) (.+)$/m.exec(section);
    if (!match) continue;
    const preconditions = /\*\*Preconditions:\*\*\s*([\s\S]+?)\n\n/.exec(section)?.[1].replace(/\s+/g, " ").trim() ?? "";
    const steps = section
      .split("\n")
      .filter((line) => /^\| \d+ \|/.test(line))
      .map((line) => {
        const [, , action, expected] = line.split("|").map((cell) => cell.trim());
        return { action: action.replace(/`/g, ""), expected: expected.replace(/`/g, "").replace(/\*\*/g, "") };
      });
    cases.set(match[1], { title: match[2].trim(), preconditions, steps });
  }
  return cases;
}

export async function seedTestPlans(adminId: string): Promise<void> {
  const projectId = newId("prj");
  await db.insert(schema.tpProjects).values({ id: projectId, name: "DriveNow" });
  const folders = new Map<string, string>();
  let suitePosition = 0;
  for (const [suite, children] of Object.entries(TREE)) {
    const suiteId = newId("nod");
    await db.insert(schema.tpNodes).values({ id: suiteId, projectId, parentId: null, kind: "suite", name: suite, position: suitePosition++ });
    folders.set(suite, suiteId);
    for (const child of children) {
      let parentPath = suite;
      for (const part of child.split("/")) {
        const full = `${parentPath}/${part}`;
        if (!folders.has(full)) {
          const id = newId("nod");
          const siblings = [...folders.keys()].filter((key) => key.startsWith(`${parentPath}/`) && key.split("/").length === full.split("/").length).length;
          await db.insert(schema.tpNodes).values({ id, projectId, parentId: folders.get(parentPath)!, kind: "folder", name: part, position: siblings });
          folders.set(full, id);
        }
        parentPath = full;
      }
    }
  }

  const catalog = await readCatalog(db);
  const documented = automatedCases();
  let number = 1;
  const rows: (typeof schema.tpCases.$inferInsert)[] = [];
  for (const test of [...catalog.tests].sort((a, b) => (a.testCaseId ?? "").localeCompare(b.testCaseId ?? ""))) {
    if (!test.testCaseId) continue;
    const doc = documented.get(test.testCaseId);
    const folder = AUTOMATED_FOLDER[`${test.module}/${test.feature}`] ?? "Authentication/Login";
    number = Number(test.testCaseId.slice(3));
    rows.push({
      id: newId("tcs"),
      projectId,
      nodeId: folders.get(folder)!,
      number,
      title: doc?.title ?? test.title,
      state: "active",
      priority: test.markers.includes("smoke") ? "high" : "medium",
      tags: test.markers.filter((m) => !["admin", "client", "no_login"].includes(m)),
      description: test.title,
      preconditions: doc?.preconditions ?? "",
      steps: doc?.steps ?? [],
      type: test.markers.includes("smoke") ? "smoke" : test.markers.includes("api") ? "api" : "ui",
      automation: "automated",
      automatedTest: test.nodeid,
      createdBy: adminId,
    });
  }
  for (const manual of MANUAL) {
    number += 1;
    rows.push({
      id: newId("tcs"),
      projectId,
      nodeId: folders.get(manual.folder)!,
      number,
      title: manual.title,
      state: manual.state,
      priority: manual.priority,
      tags: manual.tags,
      preconditions: manual.preconditions ?? "",
      steps: manual.steps,
      type: manual.type as "functional",
      createdBy: adminId,
    });
  }
  await db.insert(schema.tpCases).values(rows);
  await db.update(schema.tpProjects).set({ nextNumber: number + 1 }).where(eq(schema.tpProjects.id, projectId));
}
