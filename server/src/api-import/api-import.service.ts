/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';

@Injectable()
export class RestApiImportService {
  constructor(private readonly aiService: AiService) {}

  async fetch(data: GenerateFetchResponse): Promise<unknown> {
    const { url, params } = data;

    const response = await fetch(url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
    });

    // Handle non-2xx responses
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    // Determine response type based on content-type header
    const contentType = response.headers.get('content-type');
    let responseData: unknown;

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else if (contentType?.includes('text/')) {
      responseData = await response.text();
    } else {
      // For other types, try JSON first, fallback to text
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    }

    return responseData;
  }

  async generateFetch(
    request: GenerateFetchRequest,
  ): Promise<GenerateFetchResponse> {
    const aiPrompt = `
You are a fetch parameter generator. Based on the user's request, generate a valid JSON object that contains the parameters needed for a JavaScript fetch() call.

The JSON should have this exact structure:
{
  "url": "the complete URL to call",
  "params": {
    "method": "GET|POST|PUT|DELETE|etc",
    "headers": {},
    "body": null or JSON string for POST/PUT requests
  }
}

Guidelines:
- Always include the "method" field (default to "GET" if not specified)
- Include appropriate headers if needed (e.g., "Content-Type": "application/json" for JSON requests)
- Set body to null for GET requests, or to a JSON string for POST/PUT requests
- Include authentication headers if mentioned in the request (e.g., "Authorization": "Bearer token")
- Focus on data fetching/API calls
- Only return the JSON object itself, no explanations or additional text
- The JSON should be valid and parseable

User request: ${request.prompt}

Generate only the JSON object:
    `;

    const result = await this.aiService.generate(aiPrompt);

    // Clean up the response to extract just the JSON
    let cleanedResponse = result.trim();

    // Remove common formatting artifacts
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '');
    cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    cleanedResponse = cleanedResponse.trim();

    // Parse the JSON to validate it
    const parsedJson = JSON.parse(cleanedResponse);

    // Validate the structure
    if (!parsedJson.url || !parsedJson.params) {
      throw new Error('AI response missing required url or params fields');
    }

    if (!parsedJson.params.method) {
      parsedJson.params.method = 'GET';
    }

    return {
      url: parsedJson.url,
      params: parsedJson.params,
    };
  }
}
export type ApiImportData = {
  externalBaseId: string;
  tableName: string;
  records: any;
  matchOn: string;
};

export type GenerateFetchRequest = {
  prompt: string;
};

export type GenerateFetchResponse = {
  url: string;
  params: {
    method: string;
    headers: Record<string, string>;
    body?: string | null;
  };
};

export type ImportResult = {
  created: number;
  updated: number;
  failed: number;
};
