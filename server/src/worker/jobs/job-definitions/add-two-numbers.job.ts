import { PrismaClient } from '@prisma/client';
import { JsonSafeObject } from 'src/utils/objects';
import { JobDefinitionBuilder, JobHandlerBuilder, JobResult, Progress } from '../base-types';

export type AddTwoNumbersJobDefinition = JobDefinitionBuilder<
  'add-two-numbers',
  {
    a: number;
    b: number;
    userId: string;
  },
  JsonSafeObject,
  JsonSafeObject,
  JobResult
>;

export const AddTwoNumbersJobHandler: JobHandlerBuilder<AddTwoNumbersJobDefinition> = {
  run: async (params: {
    data: AddTwoNumbersJobDefinition['data'];
    progress: Progress<AddTwoNumbersJobDefinition['publicProgress'], AddTwoNumbersJobDefinition['initialJobProgress']>;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<AddTwoNumbersJobDefinition['publicProgress'], AddTwoNumbersJobDefinition['initialJobProgress']>,
        'timestamp'
      >,
    ) => Promise<void>;
  }) => {
    const { data } = params;
    const startTime = Date.now();

    try {
      // Create a new Prisma client for this worker
      const prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      });

      // Fake API call - count snapshots
      const snapshotCount = await prisma.snapshot.count();

      // Perform the actual job
      const result = data.a + data.b;

      // Clean up the Prisma client
      await prisma.$disconnect();

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        executionTime,
        snapshotCount,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  },
};
