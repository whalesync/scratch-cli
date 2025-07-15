/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createViewId } from '../types/ids';
import { UpsertViewDto } from './dto/upsert-view.dto';
import { View } from './entities/view.entity';

@Injectable()
export class ViewService {
  constructor(private readonly db: DbService) {}

  async upsertView(dto: UpsertViewDto): Promise<View> {
    const { save = false, ...viewData } = dto;

    // If saving and we have a parentId, we need to delete the parent first
    if (save && viewData.parentId) {
      // Delete the parent view
      await this.db.client.view.delete({
        where: { id: viewData.parentId },
      });
    }

    // If we have an id, this is an update operation
    if (viewData.id) {
      if (save && viewData.parentId) {
        // Save unsaved view: delete parent, create new with new id
        const createData = { ...viewData };
        delete createData.parentId;
        const view = await this.db.client.view.create({
          data: {
            id: createViewId(),
            ...createData,
          },
        });
        return new View(view);
      } else {
        // Regular update: update existing view
        const view = await this.db.client.view.update({
          where: { id: viewData.id },
          data: viewData,
        });
        return new View(view);
      }
    } else {
      // Create new view
      const view = await this.db.client.view.create({
        data: {
          id: createViewId(),
          ...viewData,
        },
      });
      return new View(view);
    }
  }

  async getView(id: string): Promise<View | null> {
    const view = await this.db.client.view.findUnique({
      where: { id },
    });

    return view ? new View(view) : null;
  }

  async getViewsBySnapshot(snapshotId: string): Promise<View[]> {
    const views = await this.db.client.view.findMany({
      where: { snapshotId },
      orderBy: { createdAt: 'desc' },
    });

    return views.map((view) => new View(view));
  }

  async deleteView(id: string): Promise<void> {
    await this.db.client.view.delete({
      where: { id },
    });
  }
}
