/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createViewId } from '../types/ids';
import { UpsertViewDto } from './dto/upsert-view.dto';
import { ColumnView } from './entities/column-view.entity';

@Injectable()
export class ViewService {
  constructor(private readonly db: DbService) {}

  async upsertView(dto: UpsertViewDto): Promise<ColumnView> {
    // If we have an id, this is an update operation
    if (dto.id) {
      const view = await this.db.client.columnView.update({
        where: { id: dto.id },
        data: dto,
      });
      return new ColumnView(view);
    } else {
      // Create new view
      const view = await this.db.client.columnView.create({
        data: {
          id: createViewId(),
          ...dto,
        },
      });
      return new ColumnView(view);
    }
  }

  async getView(id: string): Promise<ColumnView | null> {
    const view = await this.db.client.columnView.findUnique({
      where: { id },
    });

    return view ? new ColumnView(view) : null;
  }

  async getViewsBySnapshot(snapshotId: string): Promise<ColumnView[]> {
    const views = await this.db.client.columnView.findMany({
      where: { snapshotId },
      orderBy: { createdAt: 'desc' },
    });

    return views.map((view) => new ColumnView(view));
  }

  async deleteView(id: string): Promise<void> {
    await this.db.client.columnView.delete({
      where: { id },
    });
  }
}
