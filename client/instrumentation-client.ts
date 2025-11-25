import posthog from 'posthog-js';

/**
 * Configures instrumentation of Next.js for Posthog error tracking
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2025-05-24',
  });
}
