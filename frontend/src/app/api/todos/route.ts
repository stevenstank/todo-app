import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAuthToken, getAuthUserId, getStrapiUrl, getUserIdFromToken } from '@/lib/server/strapi';
import { TODOS_PATH, TODOS_TAG, getTodosUserTag } from '@/lib/server/cache';
import { buildTodosByUserPath } from '@/lib/server/todos-query';

const unauthorized = () =>
  NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 });

const isDebug = process.env.NODE_ENV !== 'production';

const readBearerToken = (request: NextRequest): string | null => {
  const value = request.headers.get('authorization');

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');

  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
};

export async function GET(request: NextRequest) {
  const token = getAuthToken() ?? readBearerToken(request);
  const authUserId = token ? getUserIdFromToken(token) ?? getAuthUserId() : null;

  if (!token || typeof authUserId !== 'number') {
    return unauthorized();
  }

  const incomingQuery = request.nextUrl.searchParams.toString();
  const path = buildTodosByUserPath(authUserId);
  const response = await fetch(getStrapiUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (isDebug) {
    const items = Array.isArray((payload as { data?: Array<{ id?: number }> })?.data)
      ? (payload as { data: Array<{ id?: number }> }).data
      : [];
    const total = items.length;

    const ids = items
      .map((item) => item?.id)
      .filter((id): id is number => typeof id === 'number');

    console.info('[todos][GET][user-scoped]', {
      userId: authUserId,
      status: response.status,
      total,
      ids,
      incomingQuery,
      path,
    });

    if (ids.length !== total) {
      console.warn('[todos][GET][user-scoped][unexpected-shape]', {
        userId: authUserId,
        total,
      });
    }
  }

  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  const token = getAuthToken() ?? readBearerToken(request);
  const authUserId = token ? getUserIdFromToken(token) ?? getAuthUserId() : null;

  if (!token) {
    return unauthorized();
  }

  const body = await request.text();
  const response = await fetch(getStrapiUrl('/api/todos'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    revalidatePath(TODOS_PATH);
    revalidateTag(TODOS_TAG);

    if (typeof authUserId === 'number') {
      revalidateTag(getTodosUserTag(authUserId));
    }
  }

  return NextResponse.json(payload, { status: response.status });
}
