import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const isProtectedRoute = pathname.startsWith('/todos') || pathname.startsWith('/dashboard');
  const isPublicAuthRoute =
    pathname.startsWith('/login') || pathname.startsWith('/signin') || pathname.startsWith('/signup');

  if (isProtectedRoute) {
    if (!token) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
  }

  if (isPublicAuthRoute) {
    if (token) {
      const redirectUrl = new URL('/dashboard', request.url);
      redirectUrl.searchParams.set('notice', 'already-signed-in');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/todos/:path*', '/dashboard/:path*', '/login', '/signin', '/signup'],
};
