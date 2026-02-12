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
 * @deprecated Use handleAxiosError instead
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

export function getHumanReadableErrorMessage(error: unknown): string {
  if (error instanceof ScratchpadApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export const isUnauthorizedError = (error: unknown): boolean => {
  return !!(error && error instanceof ScratchpadApiError && error.statusCode === 401);
};

/**
 * Handles axios errors and converts them to ScratchpadApiError
 * @param error The error from axios
 * @param fallbackMessage Error message to use if error details can't be extracted
 * @throws ScratchpadApiError
 */
export function handleAxiosError(error: unknown, fallbackMessage: string): never {
  // Check if it's an internal axios error
  if (error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError) {
    const axiosError = error as {
      response?: {
        status: number;
        statusText: string;
        data?: ScratchpadApiErrorResponse;
      };
      code?: string;
      message?: string;
    };

    // Network error (connection refused, DNS failure, etc.)
    if (!axiosError.response) {
      throw new ScratchpadApiError(
        fallbackMessage || 'Scratch servers are currently unavailable. Please try again later.',
        0,
        axiosError.code || 'Connection Error',
      );
    }

    // HTTP error response
    const errorResponse = axiosError.response.data as ScratchpadApiErrorResponse | undefined;
    throw new ScratchpadApiError(
      errorResponse?.message || errorResponse?.error || fallbackMessage,
      axiosError.response.status,
      axiosError.response.statusText,
    );
  }

  // Re-throw as-is if not an axios error
  throw error;
}
