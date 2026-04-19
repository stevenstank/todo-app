import { cookies } from 'next/headers';
import { STRAPI_BASE_URL } from '@/lib/api';

const TOKEN_COOKIE_NAME = 'token';

type JwtPayload = {
  id?: number;
  sub?: string | number;
};

export const getAuthToken = (): string | null => {
  const token = cookies().get(TOKEN_COOKIE_NAME)?.value;
  return token && token.trim() ? token : null;
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.');

    if (parts.length < 2) {
      return null;
    }

    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const normalized = payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, '=');
    const payloadJson = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(payloadJson) as JwtPayload;
  } catch {
    return null;
  }
};

export const getUserIdFromToken = (token: string): number | null => {
  const payload = decodeJwtPayload(token);

  if (typeof payload?.id === 'number') {
    return payload.id;
  }

  if (typeof payload?.sub === 'number') {
    return payload.sub;
  }

  if (typeof payload?.sub === 'string') {
    const parsed = Number(payload.sub);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export const getAuthUserId = (): number | null => {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  return getUserIdFromToken(token);
};

export const getStrapiUrl = (path: string): string =>
  new URL(path, `${STRAPI_BASE_URL}/`).toString();

export const tokenCookieName = TOKEN_COOKIE_NAME;
