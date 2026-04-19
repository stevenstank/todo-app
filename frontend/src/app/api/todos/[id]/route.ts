import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAuthToken, getAuthUserId, getStrapiUrl, getUserIdFromToken } from '@/lib/server/strapi';
import { TODOS_PATH, TODOS_TAG, getTodosUserTag } from '@/lib/server/cache';
import { buildTodoByIdForUserPath } from '@/lib/server/todos-query';

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

type Context = {
  params: {
    id: string;
  };
};

export async function PUT(request: NextRequest, context: Context) {
  const token = getAuthToken() ?? readBearerToken(request);
  const authUserId = token ? getUserIdFromToken(token) ?? getAuthUserId() : null;

  if (!token) {
    return unauthorized();
  }

  const body = await request.text();
  const response = await fetch(getStrapiUrl(`/api/todos/${context.params.id}`), {
    method: 'PUT',
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

export async function DELETE(_request: NextRequest, context: Context) {
  const token = getAuthToken() ?? readBearerToken(_request);
  const authUserId = token ? getUserIdFromToken(token) ?? getAuthUserId() : null;

  if (!token) {
    return unauthorized();
  }

  if (isDebug) {
    console.info('[todos][DELETE][request]', {
      url: _request.nextUrl.pathname,
      method: _request.method,
      todoId: context.params.id,
      hasAuthorizationHeader: Boolean(_request.headers.get('authorization')),
      hasToken: Boolean(token),
    });
  }

  const response = await fetch(getStrapiUrl(`/api/todos/${context.params.id}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (isDebug) {
    console.info('[todos][DELETE][response]', {
      todoId: context.params.id,
      status: response.status,
      payload,
    });
  }

  if (response.ok) {
    let verifyStatus: number | null = null;

    if (isDebug && typeof authUserId === 'number') {
      const verifyPath = buildTodoByIdForUserPath(context.params.id, authUserId);
      const verifyResponse = await fetch(getStrapiUrl(verifyPath), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as { data?: unknown[] };
      const remaining = Array.isArray(verifyPayload.data) ? verifyPayload.data.length : 0;
      verifyStatus = remaining === 0 ? 404 : 200;

      console.info('[todos][DELETE][verify]', {
        todoId: context.params.id,
        userId: authUserId,
        deleteStatus: response.status,
        verifyStatus,
        remaining,
      });
    }

    if (isDebug && verifyStatus === null) {
      console.info('[todos][DELETE]', {
        todoId: context.params.id,
        userId: authUserId,
        deleteStatus: response.status,
      });
    }

    revalidatePath(TODOS_PATH);
    revalidateTag(TODOS_TAG);

    if (typeof authUserId === 'number') {
      revalidateTag(getTodosUserTag(authUserId));
    }
  }

  if (isDebug && !response.ok) {
    console.warn('[todos][DELETE][failed]', {
      todoId: context.params.id,
      userId: authUserId,
      status: response.status,
      payload,
    });
  }

  return NextResponse.json(payload, { status: response.status });
}
