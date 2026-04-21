import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getStrapiUrl } from '@/lib/server/strapi';

const unauthorized = () =>
  NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 });

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

  if (!token) {
    return unauthorized();
  }

  const response = await fetch(getStrapiUrl('/api/todos/assignable-users'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
