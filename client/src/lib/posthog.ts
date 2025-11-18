import { ScratchPadUser } from '@/hooks/useScratchpadUser';
import { Workbook } from '@/types/server-entities/workbook';
import _ from 'lodash';
import posthog from 'posthog-js';

export enum PostHogEvents {
  PAGE_VIEW = '$pageview',
  CLICK_MANAGE_SUBSCRIPTION = 'click_manage_subscription',
  ACCEPT_SUGGESTIONS = 'accept_suggestions',
  REJECT_SUGGESTIONS = 'reject_suggestions',
  START_AGENT_SESSION = 'start_agent_session',
  SEND_AGENT_MESSAGE = 'send_agent_message',
  TOGGLE_DISPLAY_MODE = 'toggle_display_mode',
  CLICK_DOWNLOAD_RESOURCE = 'click_download_resource',
  ADD_RESOURCE_TO_CHAT = 'add_resource_to_chat',
  REMOVE_RESOURCE_FROM_CHAT = 'remove_resource_from_chat',
  OPEN_OLD_CHAT_SESSION = 'open_old_chat_session',
  CHANGE_AGENT_MODEL = 'change_agent_model',
  CHANGE_AGENT_CAPABILITIES = 'change_agent_capabilities',
  CLICK_CREATE_RESOURCE_IN_CHAT = 'click_create_resource_in_chat',
  CLICK_VIEW_RESOURCE_FROM_CHAT = 'click_view_resource_from_chat',
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
 * Send an exception to PostHog outside of the default error handling flow
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

export function trackAcceptChanges(items: { wsId: string; columnId: string }[], snapshot: Workbook | undefined): void {
  const changeCount = items.length;
  const uniqueRecordCount = _.uniqBy(items, 'wsId').length;
  captureEvent(PostHogEvents.ACCEPT_SUGGESTIONS, {
    changeCount,
    recordCount: uniqueRecordCount,
    ...snapshotProperties(snapshot),
  });
}

export function trackRejectChanges(items: { wsId: string; columnId: string }[], snapshot: Workbook | undefined): void {
  const changeCount = items.length;
  const uniqueRecordCount = _.uniqBy(items, 'wsId').length;
  captureEvent(PostHogEvents.REJECT_SUGGESTIONS, {
    changeCount,
    recordCount: uniqueRecordCount,
    ...snapshotProperties(snapshot),
  });
}

/** Agent / Chat events  */
export function trackStartAgentSession(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.START_AGENT_SESSION, { ...snapshotProperties(snapshot) });
}

export function trackChangeAgentModel(model: string, snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.CHANGE_AGENT_MODEL, { model, ...snapshotProperties(snapshot) });
}

export function trackChangeAgentCapabilities(capabilities: string[], snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.CHANGE_AGENT_CAPABILITIES, { capabilities, ...snapshotProperties(snapshot) });
}

export function trackSendMessage(
  messageLength: number,
  numAttachments: number,
  dataScope: string,
  snapshot: Workbook | undefined,
): void {
  captureEvent(PostHogEvents.SEND_AGENT_MESSAGE, {
    messageLength,
    numAttachments,
    dataScope,
    ...snapshotProperties(snapshot),
  });
}

export function trackOpenOldChatSession(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.OPEN_OLD_CHAT_SESSION, { ...snapshotProperties(snapshot) });
}

export function trackAddResourceToChat(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.ADD_RESOURCE_TO_CHAT, { ...snapshotProperties(snapshot) });
}

export function trackClickCreateResourceInChat(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.CLICK_CREATE_RESOURCE_IN_CHAT, { ...snapshotProperties(snapshot) });
}

export function trackClickViewResourceFromChat(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.CLICK_VIEW_RESOURCE_FROM_CHAT, { ...snapshotProperties(snapshot) });
}

export function trackRemoveResourceFromChat(snapshot: Workbook | undefined): void {
  captureEvent(PostHogEvents.REMOVE_RESOURCE_FROM_CHAT, { ...snapshotProperties(snapshot) });
}

export function trackToggleDisplayMode(mode: 'light' | 'dark'): void {
  captureEvent(PostHogEvents.TOGGLE_DISPLAY_MODE, { mode });
}

export function trackClickManageSubscription(): void {
  captureEvent(PostHogEvents.CLICK_MANAGE_SUBSCRIPTION, {});
}

export function trackClickDownloadResource(): void {
  captureEvent(PostHogEvents.CLICK_DOWNLOAD_RESOURCE, {});
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

function snapshotProperties(workbook: Workbook | undefined | null): Record<string, unknown> {
  if (!workbook) {
    return {};
  }

  return {
    workbookId: workbook.id,
    workbookName: workbook.name,
    connector: workbook.snapshotTables?.[0]?.connectorService,
  };
}
