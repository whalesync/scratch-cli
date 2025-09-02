import { ScratchPadUser } from '@/hooks/useScratchpadUser';
import posthog from 'posthog-js';

export enum PostHogEvents {
  PAGE_VIEW = '$pageview',
}

export function captureEvent(eventName: PostHogEvents, additionalProperties: Record<string, unknown> = {}): void {
  // Analytics functions should NEVER throw errors
  try {
    posthog.capture(eventName, additionalProperties);
  } catch (e) {
    console.error('Failed to capture event', e);
  }
}

/**
 * Send an execption to PostHog outside of the default error handling flow
 * @param error The error to send
 * @param properties Set of extra KVPs to send with the exception
 */
export function captureException(error: Error, properties: Record<string, unknown> = {}): void {
  try {
    posthog.captureException(error, properties);
  } catch (e) {
    console.error('Failed to capture exception in Posthog', e);
  }
}


export function trackPageView(url: string): void {
  captureEvent(PostHogEvents.PAGE_VIEW, { url });
}

/**
 * Posthog tracking to identify user on sign-in
 */
export function trackUserSignIn(user: ScratchPadUser): void {
  if (user && user.user && user.clerkUser) {
    const userId = user.user.id;
    const email = user.clerkUser.emailAddresses[0].emailAddress;

    try {
      posthog.identify(userId, { email });
    } catch (error) {
      console.error('Error tracking user sign in', error);
    }
  }
}