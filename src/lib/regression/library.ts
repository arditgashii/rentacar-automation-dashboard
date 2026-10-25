// The teams of Manual Regression and the DriveNow regression library each team starts its runs from.

export const TEAMS = ["Core", "Fleet", "Bookings", "Payments", "Admin Portal", "Platform", "AI Features"] as const;
export type Team = (typeof TEAMS)[number];

export const KINDS = [
  { key: "before-release", label: "Before release", description: "Check the release candidate before it goes live." },
  { key: "after-release", label: "After release", description: "Check live after the release." },
  { key: "e2e", label: "E2E testing", description: "A full end-to-end pass." },
  { key: "sprint", label: "Sprint testing", description: "Stories, tasks and bugs of a sprint." },
] as const;
export type RegressionKind = (typeof KINDS)[number]["key"];

export const ENVIRONMENTS = ["Development"] as const;

type Library = Record<string, Record<string, string[]>>;

export const LIBRARY: Record<Team, Library> = {
  Core: {
    Authentication: {
      Login: ["Log in as admin", "Log in as client", "Wrong password shows an error", "Inactive account cannot log in"],
      Registration: ["Register a new client", "Duplicate email is refused", "Short password is refused"],
      Session: ["Log out", "Back after logout shows the login page", "Private pages need a login"],
    },
    Notifications: {
      "Booking notifications": ["Owner is notified of a new booking", "Client is notified when confirmed", "Client is notified when cancelled"],
    },
  },
  Fleet: {
    "Car listings": {
      Create: ["Create a car with all fields", "Required fields are checked", "Duplicate plate is refused", "A new car is available"],
      Edit: ["Edit the price with decimals", "Edit mileage and features", "Set the status to maintenance", "Only the owner and admins can edit"],
      Delete: ["Owner deletes a car", "Admin deletes any car", "A confirmation dialog appears first"],
    },
    Photos: {
      Upload: ["Upload a JPG", "Upload PNG and WEBP", "Refuse a file that is not an image", "Refuse a file over 5 MB", "At most 8 photos"],
      Manage: ["Set the main photo", "Reorder photos", "Deleting the main photo picks a new one"],
    },
    Search: {
      Filters: ["Filter by city", "Filter by type", "Filter by transmission and fuel", "Min and max price", "Seats"],
      Sorting: ["Newest first", "Price low to high", "Price high to low"],
      Pagination: ["12 cars per page", "Next and previous"],
    },
  },
  Bookings: {
    Bookings: {
      Request: ["Book valid dates", "Total price is right", "Cannot book your own car", "Cannot book in the past", "At most 30 days", "Overlapping dates are refused"],
      Manage: ["Client cancels a booking", "Admin confirms a booking", "Admin cancels a booking", "A cancelled booking cannot be cancelled again"],
    },
  },
  Payments: {
    "Pricing and deposits": {
      Prices: ["Daily price with decimals", "Deposit on the car page", "Total before booking"],
      Revenue: ["Revenue this month on the dashboard"],
    },
  },
  "Admin Portal": {
    "Admin portal": {
      Dashboard: ["Stat tiles show the right counts", "Recent bookings list"],
      Users: ["Deactivate a user", "Activate a user", "Make a client an admin", "An admin cannot demote themselves"],
      Cars: ["Search cars", "Filter by status"],
    },
  },
  Platform: {
    Observability: {
      Health: ["/health answers", "/health/ready checks every dependency"],
      Metrics: ["/metrics exposes request metrics", "The Grafana dashboard shows traffic"],
      Logging: ["Every log line has a request id"],
    },
    Infrastructure: {
      Docker: ["docker compose up starts every service", "Seed data is created once"],
    },
  },
  "AI Features": {
    "Car descriptions": {
      Generate: ["Generate a description for your own car", "It names make, model and year", "It never mentions a price", "Falls back to the template when the LLM fails"],
    },
  },
};
