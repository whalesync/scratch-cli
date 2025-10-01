/**
 * NestJS response from the server when an exception occurs
 */
export interface ScratchpadApiErrorResponse {
  message: string;
  error: string;
  statusCode: number; 
}

export class ScratchpadApiError extends Error {
  constructor(message: string, public statusCode: number, public statusText: string) {
    super(message);
  }
}

/**
 * Checks for a failed API call response and throws a standard ScratchpadApiError
 * @param res response from the server
 * @param fallbackMessage error message to return if a message can be extracted from the response
 */
export async function checkForApiError(res: Response, fallbackMessage: string): Promise<void> {
  if(!res.ok){
    const errorResponse = await res.json().catch(() => ({})) as ScratchpadApiErrorResponse;
    throw new ScratchpadApiError(errorResponse.message || errorResponse.error || fallbackMessage, res.status, res.statusText);
  }
}