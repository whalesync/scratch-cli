export class ScratchpadApiError extends Error {
  constructor(message: string, public statusCode: number, public statusText: string) {
    super(message);
  }
}