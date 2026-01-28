import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount } from '@prisma/client';
import {
  createDataFolderId,
  DataFolderGroup,
  DataFolderId,
  FileId,
  ListDataFolderFilesResponseDto,
  Service,
  ValidatedCreateDataFolderDto,
  WorkbookId,
} from '@spinner/shared-types';
import { AuditLogService } from 'src/audit/audit-log.service';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { DataFolderCluster } from 'src/db/cluster-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { DecryptedCredentials } from 'src/remote-service/connector-account/types/encrypted-credentials.interface';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { Actor } from 'src/users/types';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { BaseJsonTableSpec } from '../remote-service/connectors/types';
import { DataFolderEntity, DataFolderGroupEntity } from './entities/data-folder.entity';
import { WorkbookDbService } from './workbook-db.service';
import { WorkbookService } from './workbook.service';

@Injectable()
export class DataFolderService {
  constructor(
    private readonly workbookService: WorkbookService,
    private readonly db: DbService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly connectorService: ConnectorsService,
    private readonly configService: ScratchpadConfigService,
    private readonly bullEnqueuerService: BullEnqueuerService,
    private readonly auditLogService: AuditLogService,
    private readonly workbookDbService: WorkbookDbService,
  ) {}

  async listGroupedByConnectorBases(workbookId: WorkbookId, actor: Actor): Promise<DataFolderGroup[]> {
    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Fetch all data folders for the workbook with connector account info
    const dataFolders = await this.db.client.dataFolder.findMany({
      where: {
        workbookId,
      },
      include: DataFolderCluster._validator.include,
      orderBy: {
        name: 'asc',
      },
    });

    // Group data folders by connector account
    const scratchFolders: DataFolderCluster.DataFolder[] = [];
    const connectorAccountGroups = new Map<
      string,
      {
        name: string;
        connectorAccount: DataFolderCluster.DataFolder['connectorAccount'];
        folders: DataFolderCluster.DataFolder[];
      }
    >();

    for (const folder of dataFolders) {
      if (!folder.connectorAccountId || !folder.connectorAccount) {
        scratchFolders.push(folder);
      } else {
        const accountId = folder.connectorAccountId;
        if (!connectorAccountGroups.has(accountId)) {
          connectorAccountGroups.set(accountId, {
            name: folder.connectorAccount.displayName,
            connectorAccount: folder.connectorAccount,
            folders: [],
          });
        }
        connectorAccountGroups.get(accountId)!.folders.push(folder);
      }
    }

    // Build the result array with Scratch group first
    const groups: DataFolderGroupEntity[] = [];

    // Add Scratch group first (if there are any scratch folders)
    if (scratchFolders.length > 0) {
      groups.push(
        new DataFolderGroupEntity(
          'Scratch',
          null,
          scratchFolders.map((f) => new DataFolderEntity(f)),
        ),
      );
    }

    // Add connector account groups
    for (const [, group] of connectorAccountGroups) {
      groups.push(
        new DataFolderGroupEntity(
          group.name,
          group.connectorAccount,
          group.folders.map((f) => new DataFolderEntity(f)),
        ),
      );
    }

    return groups;
  }

  async findOne(id: DataFolderId, actor: Actor): Promise<DataFolderEntity> {
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    return new DataFolderEntity(dataFolder);
  }

  async listFiles(
    id: DataFolderId,
    actor: Actor,
    limit?: number,
    offset?: number,
  ): Promise<ListDataFolderFilesResponseDto> {
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    // Get files from the workbook database using the data folder's path
    const [allFiles, totalCount] = await Promise.all([
      this.workbookDbService.workbookDb.getFilesByFolderId(dataFolder.workbookId as WorkbookId, id, { offset, limit }),
      this.workbookDbService.workbookDb.countFilesByFolderId(dataFolder.workbookId as WorkbookId, id),
    ]);

    return {
      files: allFiles.map((f) => ({
        fileId: f.id as FileId,
        filename: f.name,
        path: f.path,
        deleted: f.deleted,
      })),
      totalCount,
    };
  }

  async deleteFile(dataFolderId: DataFolderId, fileId: FileId, actor: Actor): Promise<void> {
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id: dataFolderId },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    // Delete the file
    await this.workbookDbService.workbookDb.deleteFileById(dataFolder.workbookId as WorkbookId, fileId, false);

    // Log audit event
    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted file ${fileId} from data folder ${dataFolder.name}`,
      entityId: fileId,
      context: {
        workbookId: dataFolder.workbookId,
        dataFolderId,
      },
    });
  }

  async createFolder(dto: ValidatedCreateDataFolderDto, actor: Actor): Promise<DataFolderEntity> {
    const { name, workbookId, connectorAccountId } = dto;
    const parentFolderId = (dto as { parentFolderId?: string }).parentFolderId;

    // Get the workbook (already verified in controller, but need the data)
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Load parent folder if specified to build the path
    let parentFolder: DataFolderCluster.DataFolder | null = null;
    if (parentFolderId) {
      parentFolder = await this.db.client.dataFolder.findUnique({
        where: { id: parentFolderId },
        include: DataFolderCluster._validator.include,
      });
      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
      // Verify parent folder belongs to the same workbook
      if (parentFolder.workbookId !== workbookId) {
        throw new NotFoundException('Parent folder does not belong this workbook');
      }
    }

    // Build the path based on parent folder
    const folderPath = parentFolder ? `${parentFolder.path}/${name}` : '/' + name;

    const dataFolderId = createDataFolderId();

    if (connectorAccountId && dto.tableId && dto.tableId.length > 0) {
      // Case 1: Connected folder with connector account and table IDs
      const connectorAccount = await this.connectorAccountService.findOne(connectorAccountId, actor);
      if (!connectorAccount) {
        throw new NotFoundException('Connector account not found');
      }

      const service = connectorAccount.service as Service;

      // Get connector and fetch table spec
      const connector = await this.connectorService.getConnector({
        service,
        connectorAccount: connectorAccount as ConnectorAccount,
        decryptedCredentials: connectorAccount as unknown as DecryptedCredentials,
      });

      // Fetch table spec for the first tableId
      let tableSpec: BaseJsonTableSpec;
      try {
        tableSpec = await connector.fetchJsonTableSpec({ wsId: dto.tableId[0], remoteId: dto.tableId });
      } catch (error) {
        throw exceptionForConnectorError(error, connector);
      }

      // Create the DataFolder
      const createdDataFolder = await this.db.client.dataFolder.create({
        data: {
          id: dataFolderId,
          name,
          workbookId,
          connectorAccountId,
          connectorService: service,
          parentId: parentFolderId ?? null,
          path: folderPath,
          lock: 'download',
          schema: tableSpec,
          lastSchemaRefreshAt: new Date(),
          version: 1,
          tableId: dto.tableId,
        },
        include: DataFolderCluster._validator.include,
      });

      // Trigger download job
      if (this.configService.getUseJobs()) {
        try {
          await this.bullEnqueuerService.enqueueDownloadLinkedFolderFilesJob(workbookId, actor, dataFolderId);
          WSLogger.info({
            source: 'DataFolderService.createFolder',
            message: 'Started downloading files for newly created data folder',
            workbookId,
            dataFolderId,
          });
        } catch (error) {
          WSLogger.error({
            source: 'DataFolderService.createFolder',
            message: 'Failed to start download job for newly created data folder',
            error,
            workbookId,
            dataFolderId,
          });
        }
      }

      // Log audit event
      await this.auditLogService.logEvent({
        actor,
        eventType: 'create',
        message: `Created linked data folder ${name} in workbook ${workbook.name}`,
        entityId: dataFolderId,
        context: {
          workbookId,
          connectorAccountId,
          service,
          tableSpec: tableSpec?.name,
        },
      });

      return new DataFolderEntity(createdDataFolder);
    } else {
      // Case 2: Scratch folder with no connector
      const createdDataFolder = await this.db.client.dataFolder.create({
        data: {
          id: dataFolderId,
          name,
          workbookId,
          connectorAccountId: null,
          connectorService: null,
          parentId: parentFolderId ?? null,
          path: folderPath,
          lastSchemaRefreshAt: new Date(),
          version: 1,
        },
        include: DataFolderCluster._validator.include,
      });

      // Log audit event
      await this.auditLogService.logEvent({
        actor,
        eventType: 'create',
        message: `Created scratch data folder ${name} in workbook ${workbook.name}`,
        entityId: dataFolderId,
        context: {
          workbookId,
          parentFolderId: parentFolderId ?? null,
        },
      });

      return new DataFolderEntity(createdDataFolder);
    }
  }

  async deleteFolder(id: DataFolderId, actor: Actor): Promise<void> {
    // Fetch the data folder
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    // delete the files related to this folder
    await this.workbookDbService.workbookDb.deleteFilesInFolder(
      dataFolder.workbookId as WorkbookId,
      dataFolder.id as DataFolderId,
    );

    // Delete the data folder (cascades to children due to schema relation)
    await this.db.client.dataFolder.delete({
      where: { id },
    });

    // Log audit event
    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted data folder ${dataFolder.name} from workbook ${workbook.name}`,
      entityId: id,
      context: {
        workbookId: dataFolder.workbookId,
        folderName: dataFolder.name,
      },
    });
  }

  async renameFolder(id: DataFolderId, newName: string, actor: Actor): Promise<DataFolderEntity> {
    // Fetch the data folder
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Only scratch folders can be renamed
    if (dataFolder.connectorAccountId) {
      throw new BadRequestException('Only scratch folders can be renamed');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    // Build the new path
    const parentPath = dataFolder.parentId ? dataFolder.path?.substring(0, dataFolder.path.lastIndexOf('/')) || '' : '';
    const newPath = parentPath ? `${parentPath}/${newName}` : '/' + newName;

    // Update the folder name and path
    const updatedDataFolder = await this.db.client.dataFolder.update({
      where: { id },
      data: {
        name: newName,
        path: newPath,
      },
      include: DataFolderCluster._validator.include,
    });

    // Update paths of all children recursively
    await this.updateChildrenPaths(id, newPath);

    // Log audit event
    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Renamed data folder from ${dataFolder.name} to ${newName} in workbook ${workbook.name}`,
      entityId: id,
      context: {
        workbookId: dataFolder.workbookId,
        oldName: dataFolder.name,
        newName,
      },
    });

    return new DataFolderEntity(updatedDataFolder);
  }

  async moveFolder(id: DataFolderId, newParentFolderId: string | null, actor: Actor): Promise<DataFolderEntity> {
    // Fetch the data folder
    const dataFolder = await this.db.client.dataFolder.findUnique({
      where: { id },
      include: DataFolderCluster._validator.include,
    });

    if (!dataFolder) {
      throw new NotFoundException('Data folder not found');
    }

    // Only scratch folders can be moved
    if (dataFolder.connectorAccountId) {
      throw new BadRequestException('Only scratch folders can be moved');
    }

    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(dataFolder.workbookId as WorkbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Data folder not found');
    }

    // Load new parent folder if specified
    let newParentFolder: DataFolderCluster.DataFolder | null = null;
    if (newParentFolderId) {
      newParentFolder = await this.db.client.dataFolder.findUnique({
        where: { id: newParentFolderId },
        include: DataFolderCluster._validator.include,
      });
      if (!newParentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
      // Verify parent folder belongs to the same workbook
      if (newParentFolder.workbookId !== dataFolder.workbookId) {
        throw new BadRequestException('Parent folder does not belong to the same workbook');
      }
      // Prevent moving a folder into itself or its descendants
      if (newParentFolderId === id || newParentFolder.path?.startsWith(dataFolder.path + '/')) {
        throw new BadRequestException('Cannot move a folder into itself or its descendants');
      }
    }

    // Build the new path
    const newPath = newParentFolder ? `${newParentFolder.path}/${dataFolder.name}` : '/' + dataFolder.name;

    // Update the folder
    const updatedDataFolder = await this.db.client.dataFolder.update({
      where: { id },
      data: {
        parentId: newParentFolderId,
        path: newPath,
      },
      include: DataFolderCluster._validator.include,
    });

    // Update paths of all children recursively
    await this.updateChildrenPaths(id, newPath);

    // Log audit event
    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Moved data folder ${dataFolder.name} in workbook ${workbook.name}`,
      entityId: id,
      context: {
        workbookId: dataFolder.workbookId,
        oldParentId: dataFolder.parentId,
        newParentId: newParentFolderId,
        oldPath: dataFolder.path,
        newPath,
      },
    });

    return new DataFolderEntity(updatedDataFolder);
  }

  private async updateChildrenPaths(parentId: string, parentPath: string): Promise<void> {
    const children = await this.db.client.dataFolder.findMany({
      where: { parentId },
    });

    for (const child of children) {
      const childPath = `${parentPath}/${child.name}`;
      await this.db.client.dataFolder.update({
        where: { id: child.id },
        data: { path: childPath },
      });
      // Recursively update grandchildren
      await this.updateChildrenPaths(child.id, childPath);
    }
  }
}
