import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { HttpError } from "@/lib/auth/guards";

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(status: number, message: string): NextResponse {
  return json({ error: message }, status);
}

/**
 * Wraps a route handler: HttpError becomes its status, a validation error 400, anything else 500
 * with a generic message (details stay in the server log, never in the response).
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error.status, error.message);
      if (error instanceof z.ZodError) {
        const first = error.issues[0];
        const where = first?.path.length ? `${first.path.join(".")}: ` : "";
        return errorResponse(400, `${where}${first?.message ?? "Invalid request."}`);
      }
      console.error("[api]", error);
      return errorResponse(500, "Something went wrong on the server. Try again.");
    }
  };
}

/** Parses a JSON body against a strict schema: unknown fields are refused. */
export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
  return schema.parse(body);
}
