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
 * Checks for a failed API call response and throws a standard ScratchpadApiError
 * @param res response from the server
 * @param fallbackMessage error message to return if a message can be extracted from the response
 */
export async function checkForApiError(res: Response, fallbackMessage: string): Promise<void> {
  if (!res.ok) {
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
