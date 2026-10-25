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
      Roles: ["Client sees only client pages", "Admin sees the admin menu", "A deactivated user is logged out"],
    },
    Notifications: {
      "Booking notifications": ["Owner is notified of a new booking", "Client is notified when confirmed", "Client is notified when cancelled"],
      "Notification list": ["Unread count in the header", "Mark one as read", "Mark all as read"],
    },
  },
  Fleet: {
    "Car listings": {
      Create: ["Create a car with all fields", "Required fields are checked", "Duplicate plate is refused", "A new car is available", "Price must be above zero", "Year cannot be in the future"],
      Edit: ["Edit the price with decimals", "Edit mileage and features", "Set the status to maintenance", "Only the owner and admins can edit"],
      Delete: ["Owner deletes a car", "Admin deletes any car", "A confirmation dialog appears first"],
      "Car page": ["Shows photos, price and features", "An unavailable car cannot be booked", "Only the owner sees Edit"],
    },
    Photos: {
      Upload: ["Upload a JPG", "Upload PNG and WEBP", "Refuse a file that is not an image", "Refuse a file over 5 MB", "At most 8 photos"],
      Manage: ["Set the main photo", "Reorder photos", "Deleting the main photo picks a new one"],
    },
    Search: {
      Filters: ["Filter by city", "Filter by type", "Filter by transmission and fuel", "Min and max price", "Seats", "Clear all filters", "Filters stay in the URL"],
      Sorting: ["Newest first", "Price low to high", "Price high to low"],
      Pagination: ["12 cars per page", "Next and previous"],
    },
  },
  Bookings: {
    Bookings: {
      Request: ["Book valid dates", "Total price is right", "Cannot book your own car", "Cannot book in the past", "At most 30 days", "Overlapping dates are refused", "Return date after pickup date", "Booking needs a login"],
      Manage: ["Client cancels a booking", "Admin confirms a booking", "Admin cancels a booking", "A cancelled booking cannot be cancelled again"],
      "My bookings": ["Lists upcoming and past bookings", "Shows the status of each booking", "Empty state links to Browse cars"],
    },
  },
  Payments: {
    "Pricing and deposits": {
      Prices: ["Daily price with decimals", "Deposit on the car page", "Total before booking", "Price per day times days", "Prices show two decimals"],
      Refunds: ["A cancelled booking shows the refund status", "The deposit is returned after the trip", "The refund matches the deposit"],
      Revenue: ["Revenue this month on the dashboard"],
    },
  },
  "Admin Portal": {
    "Admin portal": {
      Dashboard: ["Stat tiles show the right counts", "Recent bookings list"],
      Users: ["Deactivate a user", "Activate a user", "Make a client an admin", "An admin cannot demote themselves", "Search users by email", "Page through users"],
      Bookings: ["List all bookings", "Filter bookings by status", "Confirm from the list", "Cancel from the list"],
      Cars: ["Search cars", "Filter by status"],
    },
  },
  Platform: {
    Observability: {
      Health: ["/health answers", "/health/ready checks every dependency", "Readiness fails when the database is down"],
      Metrics: ["/metrics exposes request metrics", "The Grafana dashboard shows traffic"],
      Logging: ["Every log line has a request id"],
    },
    Infrastructure: {
      Docker: ["docker compose up starts every service", "Seed data is created once"],
      "Service Bus": ["booking.created is published", "The notifications subscription receives it", "The audit subscription receives it", "A failing message goes to the dead letter queue"],
      Storage: ["Photos are stored in Blob storage", "Deleted photos are removed from storage", "Secrets come from Key Vault"],
    },
  },
  "AI Features": {
    "Car descriptions": {
      Generate: ["Generate a description for your own car", "It names make, model and year", "It never mentions a price", "Falls back to the template when the LLM fails", "Shows a loading state while generating"],
      Limits: ["At most 5 generations per hour", "The owner can edit the text before saving", "The text is in English"],
    },
  },
};
