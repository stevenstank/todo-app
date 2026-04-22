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

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken() ?? readBearerToken(request);

    if (!token) {
      return unauthorized();
    }

    const body = await request.text();
    const explicitStrapiUrl = process.env.STRAPI_URL?.trim();
    const destination = explicitStrapiUrl
      ? new URL('/api/ai/generate-todos', `${explicitStrapiUrl.replace(/\/$/, '')}/`).toString()
      : getStrapiUrl('/api/ai/generate-todos');

    console.log('[api/ai/generate-todos] Calling Strapi:', destination);

    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error('[api/ai/generate-todos] Strapi error response:', {
        status: response.status,
        body: rawText,
      });
    }

    return new NextResponse(rawText || '{}', {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[api/ai/generate-todos] Next API Error:', error);
    return NextResponse.json({ error: { message: 'Proxy failed' } }, { status: 500 });
  }
}
