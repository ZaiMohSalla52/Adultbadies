import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = requestUrl.searchParams.get('next') ?? '/sign-in';

  return NextResponse.redirect(new URL(nextPath, request.url));
}
