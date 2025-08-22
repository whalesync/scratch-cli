import { Injectable } from '@nestjs/common';
import Parser from '@postlight/parser';
import axios from 'axios';
import { WSLogger } from 'src/logger';
import { DbService } from '../db/db.service';
import { createStyleGuideId } from '../types/ids';
import { CreateStyleGuideDto } from './dto/create-style-guide.dto';
import { UpdateStyleGuideDto } from './dto/update-style-guide.dto';
import { ExternalContent } from './entities/external-content.entity';
import { StyleGuide } from './entities/style-guide.entity';

@Injectable()
export class StyleGuideService {
  constructor(private readonly db: DbService) {}

  async create(createStyleGuideDto: CreateStyleGuideDto, userId: string): Promise<StyleGuide> {
    if (createStyleGuideDto.sourceUrl) {
      const { content, contentType } = await this.downloadResource(createStyleGuideDto.sourceUrl);
      createStyleGuideDto.body = content;
      createStyleGuideDto.contentType = contentType;
    }

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

  async updateExternalResource(id: string, userId: string): Promise<StyleGuide | null> {
    const styleGuide = await this.findOne(id, userId);
    if (!styleGuide) {
      return null;
    }

    if (!styleGuide.sourceUrl) {
      throw new Error(`Resource ${id} does not have a source URL`);
    }

    const { content, contentType } = await this.downloadResource(styleGuide.sourceUrl);

    return this.update(id, { body: content, contentType }, userId);
  }

  async downloadResource(url: string, timeout: number = 10000): Promise<ExternalContent> {
    try {
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': 'ScratchPad/1.0 (compatible; ScratchPadDownloader/1.0)',
        },
      });

      const content: unknown = response.data;
      const contentType: string = (response.headers['content-type'] as string) || '';

      // Convert content to string if it's not already
      const contentString: string = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

      if (contentType.includes('application/json')) {
        return {
          url,
          content: contentString,
          contentType: 'json',
        };
      }

      if (
        contentType.includes('text/markdown') ||
        contentType.includes('text/x-markdown') ||
        url.toLowerCase().endsWith('.md')
      ) {
        return {
          url,
          content: contentString,
          contentType: 'markdown',
        };
      }

      if (
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml+xml') ||
        contentType.includes('text/xml')
      ) {
        // convert the HTML to markdown
        // TODO - figure out how to fix the type errors here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const result = await Parser.parse(url, { contentType: 'markdown', html: contentString });

        return {
          url,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          content: result.content,
          contentType: 'markdown',
        };
      }

      return {
        url,
        content: contentString,
        contentType: 'text',
      };
    } catch (error) {
      WSLogger.error({
        source: 'StyleGuideService',
        message: `Failed to download context resource`,
        url,
        error: `${(error as Error).message}`,
      });
      throw new Error(`Failed to download context resource`);
    }
  }
}
