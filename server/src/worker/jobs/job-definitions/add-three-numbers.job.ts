import type { PrismaClient } from '@prisma/client';
import { JsonSafeObject } from 'src/utils/objects';
import { JobDefinitionBuilder, JobHandlerBuilder, JobResult, Progress } from '../base-types';

export type AddThreeNumbersJobDefinition = JobDefinitionBuilder<
  'add-three-numbers',
  {
    a: number;
    b: number;
    c: number;
    userId: string;
  },
  JsonSafeObject,
  JsonSafeObject,
  JobResult
>;

export class AddThreeNumbersJobHandler implements JobHandlerBuilder<AddThreeNumbersJobDefinition> {
  constructor(private readonly prisma: PrismaClient) {}

  async run(params: {
    data: AddThreeNumbersJobDefinition['data'];
    progress: Progress<AddThreeNumbersJobDefinition['publicProgress']>;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Progress<
        AddThreeNumbersJobDefinition['publicProgress'],
        AddThreeNumbersJobDefinition['initialJobProgress']
      >,
    ) => Promise<void>;
  }): Promise<JobResult> {
    const { data } = params;
    const startTime = Date.now();

    try {
      // Create a new Prisma client for this worker

      // Fake API call - count workbooks
      const workbookCount = await this.prisma.workbook.count();

      // Perform the actual job
      const result = data.a + data.b + data.c;

      // Clean up the Prisma client
      await this.prisma.$disconnect();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        executionTime,
        workbookCount,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }
}
