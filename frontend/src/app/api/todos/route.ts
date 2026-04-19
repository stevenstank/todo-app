import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getAuthToken, getAuthUserId, getStrapiUrl } from '@/lib/server/strapi';
import { TODOS_PATH, TODOS_TAG, getTodosUserTag } from '@/lib/server/cache';

const unauthorized = () =>
  NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 });

export async function GET() {
  const token = getAuthToken();

  if (!token) {
    return unauthorized();
  }

  const response = await fetch(getStrapiUrl('/api/todos'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  const token = getAuthToken();
  const authUserId = getAuthUserId();

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
