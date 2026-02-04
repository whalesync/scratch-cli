import { NextResponse } from 'next/server';

/**
 * Returns the external IP address of this server as seen by external services.
 * Useful for verifying Cloud NAT static IP configuration.
 */
export async function GET() {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `ipify returned ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { ip: string };

    return NextResponse.json({
      egress_ip: data.ip,
      timestamp: new Date().toISOString(),
      service: 'client',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
