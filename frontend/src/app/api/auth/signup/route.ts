import { NextRequest, NextResponse } from 'next/server';
import { getStrapiUrl, tokenCookieName } from '@/lib/server/strapi';

type StrapiAuthPayload = {
  jwt?: string;
  user?: Record<string, unknown>;
  error?: {
    details?: unknown;
    message?: string;
  };
};

const USER_EXISTS_MESSAGE = 'User already exists. Please log in instead.';

const readDuplicateUserError = (value: unknown): boolean => {
  if (!value) {
    return false;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return (
      normalized.includes('already taken') ||
      normalized.includes('already exists') ||
      normalized.includes('already been taken') ||
      normalized.includes('email or username are already taken')
    );
  }

  if (Array.isArray(value)) {
    return value.some((entry) => readDuplicateUserError(entry));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) => readDuplicateUserError(entry));
  }

  return false;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    email?: string;
    password?: string;
  };

  const username = body.username?.trim();
  const email = body.email?.trim();
  const password = body.password;

  if (!username || !email || !password) {
    return NextResponse.json(
      { error: { message: 'Username, email, and password are required.' } },
      { status: 400 }
    );
  }

  let response: Response;

  try {
    response = await fetch(getStrapiUrl('/api/auth/local/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        username,
        email,
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
    const isUserExistsError = readDuplicateUserError(payload?.error?.message) || readDuplicateUserError(payload?.error?.details);

    return NextResponse.json(
      {
        error: {
          message: isUserExistsError ? USER_EXISTS_MESSAGE : payload?.error?.message ?? 'Signup failed',
        },
      },
      { status: response.status || 400 }
    );
  }

  const nextResponse = NextResponse.json(
    {
      jwt: payload.jwt,
      user: payload.user ?? null,
    },
    { status: 201 }
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
