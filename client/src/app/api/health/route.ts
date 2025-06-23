import { API_CONFIG } from "@/lib/api/config";
import { NextResponse } from "next/server";

export async function GET() {
  // api server health check

  const response = await fetch(API_CONFIG.getApiServerHealthUrl());
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const serverHealthData = await response.text();

  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    serverHealth: serverHealthData,
  };

  return NextResponse.json(healthCheck, { status: 200 });
}
