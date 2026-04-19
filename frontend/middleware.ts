import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/todos')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    if (token) {
      return NextResponse.redirect(new URL('/todos', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/todos/:path*', '/login', '/signup'],
};
