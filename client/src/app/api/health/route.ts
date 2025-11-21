import { BUILD_VERSION } from '@/version';
import { NextResponse } from 'next/server';

/**
 * A simple health check endpoint to ensure the server is running for use with monitoring services and load balancers.
 * @returns A JSON response with the health check status
 */
export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    package_version: process.env.npm_package_version || '1.0.0',
    build_version: BUILD_VERSION,
  };

  return NextResponse.json(healthCheck, { status: 200 });
}
