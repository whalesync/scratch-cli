import { Injectable } from '@nestjs/common';
import { Service } from '@spinner/shared-types';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { DbService } from '../db/db.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { BaseJsonTableSpec } from '../remote-service/connectors/types';
import { EncryptedData } from '../utils/encryption';
import { PipelineInfo, PipelinePhase } from './types';

@Injectable()
export class PipelineRunService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
  ) {}

  async runPipeline(pipelineId: string, phase?: string): Promise<PipelineInfo> {
    const plan = await this.db.client.publishPlan.findUnique({ where: { id: pipelineId } });
    if (!plan) {
      throw new Error('Pipeline plan not found');
    }

    // Resolve connector
    const connector = await this.resolveConnector(plan.connectorAccountId);

    // Cache tableSpecs per folder to avoid repeated DB lookups
    const tableSpecCache = new Map<string, BaseJsonTableSpec>();

    try {
      const allPhases = ['edit', 'create', 'delete', 'backfill'] as const;
      const phasesToRun = phase ? [phase] : [...allPhases];

      for (const currentPhase of phasesToRun) {
        // Set status to {phase}s-running (e.g. "edits-running", "creates-running")
        const phasePrefix = currentPhase + 's';
        await this.db.client.publishPlan.update({
          where: { id: pipelineId },
          data: { status: `${phasePrefix}-running` },
        });

        // Fetch pending entries for this phase
        const entries = await this.db.client.publishPlanEntry.findMany({
          where: { planId: pipelineId, phase: currentPhase, status: 'pending' },
        });

        console.log(`[Run] Executing ${currentPhase} Phase: ${entries.length} entries`);

        for (const entry of entries) {
          try {
            const tableSpec = await this.getTableSpecForEntry(plan.workbookId, entry.filePath, tableSpecCache);
            await this.dispatchEntry(currentPhase, entry, connector, tableSpec);

            await this.db.client.publishPlanEntry.update({
              where: { id: entry.id },
              data: { status: 'success' },
            });
          } catch (err) {
            console.error(`[Run] Entry failed: ${entry.filePath}`, err);
            await this.db.client.publishPlanEntry.update({
              where: { id: entry.id },
              data: { status: 'failed' },
            });
            throw err; // Fail fast for now
          }
        }

        // Set completed status: backfill-completed → "completed", others → "{phase}s-completed"
        const completedStatus = currentPhase === 'backfill' && !phase ? 'completed' : `${phasePrefix}-completed`;
        await this.db.client.publishPlan.update({
          where: { id: pipelineId },
          data: { status: completedStatus },
        });
      }

      const finalStatus = phase ? `${phase}s-completed` : 'completed';

      return {
        pipelineId: plan.id,
        workbookId: plan.workbookId,
        userId: plan.userId,
        phases: plan.phases as never as PipelinePhase[],
        branchName: plan.branchName,
        createdAt: plan.createdAt,
        status: finalStatus,
      };
    } catch (err) {
      console.error('Pipeline failed', err);
      await this.db.client.publishPlan.update({
        where: { id: pipelineId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Resolve the connector instance for the given connector account.
   */
  private async resolveConnector(connectorAccountId: string | null): Promise<Connector<Service, any>> {
    if (!connectorAccountId) {
      throw new Error('No connectorAccountId on plan — cannot resolve connector');
    }

    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });
    if (!account) {
      throw new Error(`ConnectorAccount not found: ${connectorAccountId}`);
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    return this.connectorsService.getConnector({
      service: account.service as Service,
      connectorAccount: account,
      decryptedCredentials,
    });
  }

  /**
   * Get the BaseJsonTableSpec for a given entry by looking up the DataFolder.
   */
  private async getTableSpecForEntry(
    workbookId: string,
    filePath: string,
    cache: Map<string, BaseJsonTableSpec>,
  ): Promise<BaseJsonTableSpec> {
    // Extract folder path from file path (e.g. "articles/my-post.json" → "articles")
    const lastSlash = filePath.lastIndexOf('/');
    const folderPath = lastSlash === -1 ? '' : filePath.substring(0, lastSlash);

    if (cache.has(folderPath)) {
      return cache.get(folderPath)!;
    }

    // Look up the DataFolder by path (try with and without leading slash)
    const dataFolder = await this.db.client.dataFolder.findFirst({
      where: {
        workbookId,
        path: { in: [folderPath, `/${folderPath}`] },
      },
    });

    if (!dataFolder?.schema) {
      throw new Error(`No schema found for folder: ${folderPath}`);
    }

    const tableSpec = dataFolder.schema as unknown as BaseJsonTableSpec;
    cache.set(folderPath, tableSpec);
    return tableSpec;
  }

  /**
   * Dispatch a single entry to the connector based on phase.
   */
  private async dispatchEntry(
    phase: string,
    entry: { filePath: string; operation: any },
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
  ): Promise<void> {
    const operation = entry.operation as Record<string, unknown>;
    if (!operation) {
      console.warn(`[Run] Skipping entry with no operation: ${entry.filePath}`);
      return;
    }

    console.log(`[Run] Dispatching ${phase}: ${entry.filePath}`);

    switch (phase) {
      case 'edit':
      case 'backfill': {
        // Send the full JSON as an update
        await connector.updateRecords(tableSpec, [operation]);
        break;
      }
      case 'create': {
        // Strip temporary IDs before sending to connector
        const idField = tableSpec.idColumnRemoteId || 'id';
        const content = { ...operation };
        const idValue = content[idField];
        if (typeof idValue === 'string' && idValue.startsWith('sppi_')) {
          delete content[idField];
        }
        const returned = await connector.createRecords(tableSpec, [content]);
        console.log(`[Run] Create returned:`, JSON.stringify(returned[0]).substring(0, 200));
        // TODO: After creates, update git files with real IDs and update FileIndex
        break;
      }
      case 'delete': {
        // For deletes, send just the ID
        const idField = tableSpec.idColumnRemoteId || 'id';
        const remoteId = operation[idField] || operation['id'];
        if (remoteId) {
          await connector.deleteRecords(tableSpec, [{ [idField]: remoteId }]);
        } else {
          console.warn(`[Run] Delete entry has no ID: ${entry.filePath}`);
        }
        break;
      }
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }
}
