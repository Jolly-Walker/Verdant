import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Result of validating request input. On failure, `response` is a ready-to-return
 * `NextResponse` with a 400 and the first validation message — so route handlers
 * stay free of repeated `safeParse` / error-shaping boilerplate.
 */
export type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Build a JSON error response (`{ error }`) with the given status. */
export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Validate already-extracted input against a schema. */
export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): Parsed<z.infer<S>> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return { ok: false, response: jsonError(result.error.issues[0].message) };
  }
  return { ok: true, data: result.data };
}

/** Validate URL search params (as a plain object) against a schema. */
export function parseQuery<S extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): Parsed<z.infer<S>> {
  return parse(schema, Object.fromEntries(searchParams.entries()));
}

/** Parse and validate a JSON request body, returning 400 on malformed JSON too. */
export async function parseJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body') };
  }
  return parse(schema, body);
}
