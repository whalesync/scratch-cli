import { NextRequest, NextResponse } from 'next/server';

const NEST_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// This handler will forward requests from the client to the NestJS backend
// to avoid CORS issues in the browser.
async function handler(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.replace('/api/proxy', '');
    const url = `${NEST_API_URL}${path}`;

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(errorText, { status: response.status, statusText: response.statusText });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API Proxy Error:', error);
    return new NextResponse('Error proxying request', { status: 500 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE }; 