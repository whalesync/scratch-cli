/**
 * NestJS response from the server when an exception occurs
 */
export interface ScratchpadApiErrorResponse {
  message: string;
  error: string;
  statusCode: number;
}

export class ScratchpadApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusText: string,
  ) {
    super(message);
  }
}

/**
 * Wraps fetch to handle network errors (connection refused, etc.) and convert them to ScratchpadApiError
 * @param fetchPromise The promise returned by fetch
 * @param fallbackMessage Error message to use if a network error occurs
 * @returns The Response object if fetch succeeds
 * @throws ScratchpadApiError if network error occurs or if fetch fails
 */
export async function handleFetchError(fetchPromise: Promise<Response>, fallbackMessage?: string): Promise<Response> {
  try {
    return await fetchPromise;
  } catch (error) {
    // For network errors (connection refused, DNS failure, etc.) fetch will throw TypeError
    if (error instanceof TypeError) {
      throw new ScratchpadApiError(
        fallbackMessage || 'Scratch servers are currently unavailable. Please try again later.',
        0,
        'Connection Refused',
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Checks for a failed API call response and throws a standard ScratchpadApiError
 * @param res response from the server
 * @param fallbackMessage error message to return if a message can be extracted from the response
 */
export async function checkForApiError(res: Response, fallbackMessage: string): Promise<void> {
  if (!res.ok) {
    // Check for connection refused error (status 0 indicates network error/connection refused)
    if (res.status === 0) {
      throw new ScratchpadApiError(
        fallbackMessage || 'Scratch servers are currently unavailable. Please try again later.',
        res.status,
        res.statusText || 'Connection Refused',
      );
    }

    // Try to parse as JSON, but handle cases where the response might be multipart or other formats
    let errorResponse: ScratchpadApiErrorResponse = { message: '', error: '', statusCode: 0 };
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorResponse = (await res.json()) as ScratchpadApiErrorResponse;
      } else {
        // If it's not JSON, try to get the text content
        const text = await res.text();
        console.error('Non-JSON error response:', text);
      }
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
    }

    throw new ScratchpadApiError(
      errorResponse.message || errorResponse.error || fallbackMessage,
      res.status,
      res.statusText,
    );
  }
}

export const isUnauthorizedError = (error: unknown): boolean => {
  return !!(error && error instanceof ScratchpadApiError && error.statusCode === 401);
};
