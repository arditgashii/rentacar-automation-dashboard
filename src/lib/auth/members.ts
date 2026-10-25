// Members: request schemas shared by the Members API. Passwords are set here by an Admin and only
// ever stored as a bcrypt hash.

import { z } from "zod";

export const RoleSchema = z.enum(["admin", "editor", "viewer"]);

export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .regex(/[A-Za-z]/, "Use at least one letter.")
  .regex(/\d/, "Use at least one number.");

export const NewMemberSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(255),
  name: z.string().trim().min(1, "Enter a name.").max(100),
  role: RoleSchema,
  password: PasswordSchema,
});

export const MemberChangeSchema = z.union([
  z.strictObject({ role: RoleSchema }),
  z.strictObject({ password: PasswordSchema }),
  z.strictObject({ name: z.string().trim().min(1, "Enter a name.").max(100) }),
]);
