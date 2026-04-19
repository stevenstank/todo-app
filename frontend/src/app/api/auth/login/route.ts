import { NextRequest, NextResponse } from 'next/server';
import { getStrapiUrl, tokenCookieName } from '@/lib/server/strapi';

type StrapiAuthPayload = {
  jwt?: string;
  user?: Record<string, unknown>;
  error?: {
    message?: string;
  };
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: { message: 'Email and password are required.' } }, { status: 400 });
  }

  let response: Response;

  try {
    response = await fetch(getStrapiUrl('/api/auth/local'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        identifier: email,
        password,
      }),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Auth service is unavailable. Please make sure Strapi is running on port 1337.',
        },
      },
      { status: 503 }
    );
  }

  const payload = (await response.json().catch(() => ({}))) as StrapiAuthPayload;

  if (!response.ok || !payload.jwt) {
    return NextResponse.json(
      {
        error: {
          message: payload?.error?.message ?? 'Login failed',
        },
      },
      { status: response.status || 401 }
    );
  }

  const nextResponse = NextResponse.json(
    {
      user: payload.user ?? null,
    },
    { status: 200 }
  );

  nextResponse.cookies.set({
    name: tokenCookieName,
    value: payload.jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return nextResponse;
}
