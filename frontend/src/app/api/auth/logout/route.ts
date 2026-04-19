import { NextResponse } from 'next/server';
import { tokenCookieName } from '@/lib/server/strapi';

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set({
    name: tokenCookieName,
    value: '',
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return response;
}
