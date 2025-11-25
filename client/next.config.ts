import { BUILD_VERSION } from '@/version';
import { withPostHogConfig } from '@posthog/nextjs-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: true,
  devIndicators: {
    position: 'bottom-left',
  },
};

if(process.env.POSTHOG_PROJECT_ID && process.env.POSTHOG_API_KEY) {
  // Additional config to upload sourcemaps to PostHog for production builds
  nextConfig = withPostHogConfig(nextConfig, {
  envId: process.env.POSTHOG_PROJECT_ID as string, // Environment ID for the project
  personalApiKey: process.env.POSTHOG_API_KEY as string, // Personal API key for uploading sourcemaps
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: {
    enabled: true,
    version: BUILD_VERSION || undefined,
    deleteAfterUpload: true,
  },
});
};

export default nextConfig;
