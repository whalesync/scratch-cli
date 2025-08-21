import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createStyleGuideId } from '../types/ids';
import { CreateStyleGuideDto } from './dto/create-style-guide.dto';
import { UpdateStyleGuideDto } from './dto/update-style-guide.dto';
import { StyleGuide } from './entities/style-guide.entity';

@Injectable()
export class StyleGuideService {
  constructor(private readonly db: DbService) {}

  async create(createStyleGuideDto: CreateStyleGuideDto, userId: string): Promise<StyleGuide> {
    const styleGuide = await this.db.client.styleGuide.create({
      data: {
        id: createStyleGuideId(),
        ...createStyleGuideDto,
        userId,
      },
    });

    return new StyleGuide(styleGuide);
  }

  async findAll(userId: string): Promise<StyleGuide[]> {
    const styleGuides = await this.db.client.styleGuide.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return styleGuides.map((styleGuide) => new StyleGuide(styleGuide));
  }

  async findOne(id: string, userId: string): Promise<StyleGuide | null> {
    const styleGuide = await this.db.client.styleGuide.findFirst({
      where: { id, userId },
    });

    return styleGuide ? new StyleGuide(styleGuide) : null;
  }

  async update(id: string, updateStyleGuideDto: UpdateStyleGuideDto, userId: string): Promise<StyleGuide | null> {
    const styleGuide = await this.db.client.styleGuide.updateMany({
      where: { id, userId },
      data: updateStyleGuideDto,
    });

    if (styleGuide.count === 0) {
      return null;
    }

    const updatedStyleGuide = await this.db.client.styleGuide.findUnique({
      where: { id },
    });

    return updatedStyleGuide ? new StyleGuide(updatedStyleGuide) : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.db.client.styleGuide.deleteMany({
      where: { id, userId },
    });

    return result.count > 0;
  }
}
