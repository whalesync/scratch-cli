export class FetchError extends Error {
  info: unknown;
  status: number;

  constructor(message: string, info: unknown, status: number) {
    super(message);
    this.info = info;
    this.status = status;
  }
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    let info;
    try {
      info = await res.json();
    } catch {
      // The response might not be a valid JSON
      info = res.statusText;
    }
    throw new FetchError('An error occurred while fetching the data.', info, res.status);
  }
  return res.json();
};
