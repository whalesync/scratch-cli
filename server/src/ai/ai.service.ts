import { GenerateContentConfig, GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

export enum AiModel {
  GEMINI2_0_FLASH = 'gemini-2.0-flash',
  GEMINI2_5_FLASH = 'gemini-2.5-flash', // TODO: Update once in GA.
}

/**
 * Configuration for AI generation.
 * Try to keep this model/sdk agnostic for now until we have a solid pattern for swapping between AI providers and models
 */
export interface AiGenerationConfig {
  /* Context depends on the model but tells the system how much thinking effort to put into content generation.*/
  thinkingBudget?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: unknown;
}

@Injectable()
export class AiService {
  private ai: GoogleGenAI;

  constructor(private readonly configService: ScratchpadConfigService) {
    const apiKey = this.configService.getGeminiApiKey();

    if (apiKey) {
      this.ai = new GoogleGenAI({
        vertexai: true,
        apiKey: this.configService.getGeminiApiKey(),
      });
    } else {
      // try to setup using the default credentials
      this.ai = new GoogleGenAI({
        vertexai: true,
        project: '111544850301',
        location: 'us-central1',
        apiKey: this.configService.getGeminiApiKey(),
      });
    }
  }

  async generate(prompt: string, model = AiModel.GEMINI2_5_FLASH, config?: AiGenerationConfig): Promise<string> {
    const aiConfig: GenerateContentConfig = {};

    if (config?.thinkingBudget !== undefined) {
      aiConfig.thinkingConfig = {
        thinkingBudget: config.thinkingBudget,
        includeThoughts: config.thinkingBudget > 0,
      };
    }
    if (config?.responseMimeType !== undefined) {
      aiConfig.responseMimeType = config.responseMimeType;
    }

    if (config?.responseSchema) {
      aiConfig.responseSchema = config.responseSchema;
    }

    const response = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: aiConfig,
    });
    if (!response?.text) {
      throw new Error('No response text found');
    }
    return response.text;
  }
}
