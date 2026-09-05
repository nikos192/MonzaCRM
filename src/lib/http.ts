import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
export function apiError(error: unknown) {
  if (error instanceof RequestError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues.map((i) => i.message).join('. ') },
      { status: 400 },
    );
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED')
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (message === 'UNAPPROVED')
    return NextResponse.json({ error: 'This account has not been approved.' }, { status: 403 });
  console.error('CRM request failed', { type: error instanceof Error ? error.name : 'Unknown' });
  return NextResponse.json(
    { error: 'The request could not be completed. Refresh and try again.' },
    { status: 500 },
  );
}
export async function readJson(request: Request, max = 32000) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('A JSON body is required.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new RequestError('Request too large.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError('Invalid JSON.', 400);
  }
}
