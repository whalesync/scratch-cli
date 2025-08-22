import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import Parser from '@postlight/parser';
import axios, { AxiosError, HttpStatusCode } from 'axios';
import { WSLogger } from 'src/logger';
import { isValidHttpUrl } from 'src/utils/urls';
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
    // validate the DTO
    if (createStyleGuideDto.sourceUrl) {
      createStyleGuideDto.sourceUrl = this.sanitizeUrl(createStyleGuideDto.sourceUrl);
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
    // validate the DTO
    if (updateStyleGuideDto.sourceUrl) {
      updateStyleGuideDto.sourceUrl = this.sanitizeUrl(updateStyleGuideDto.sourceUrl);
    }

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

  sanitizeUrl(url: string): string {
    let sanitizedUrl = url;

    // Add protocol if missing
    if (!url.match(/^https?:\/\//)) {
      sanitizedUrl = `https://${url}`;
    }

    if (!isValidHttpUrl(sanitizedUrl)) {
      throw new BadRequestException(`Invalid URL: ${sanitizedUrl}`);
    }

    return sanitizedUrl;
  }

  async downloadResource(url: string, timeout: number = 10000): Promise<ExternalContent> {
    const sanitizedUrl = this.sanitizeUrl(url);

    // Validate the URL format
    try {
      const response = await axios.get(sanitizedUrl, {
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
          url: sanitizedUrl,
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
          url: sanitizedUrl,
          content: contentString,
          contentType: 'markdown',
        };
      }

      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        // convert the HTML to markdown
        // TODO - figure out how to fix the type errors here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const result = await Parser.parse(url, { contentType: 'markdown', html: contentString });

        return {
          url: sanitizedUrl,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          content: result.content,
          contentType: 'markdown',
        };
      }

      return {
        url: sanitizedUrl,
        content: contentString,
        contentType: 'text',
      };
    } catch (error) {
      WSLogger.error({
        source: 'StyleGuideService',
        message: `Failed to download context resource`,
        url: sanitizedUrl,
        error: `${(error as Error).message}`,
      });

      if (error instanceof AxiosError) {
        const axiosError = error as AxiosError;
        if (
          axiosError.response?.status === HttpStatusCode.NotFound ||
          axiosError.response?.status === HttpStatusCode.ServiceUnavailable
        ) {
          throw new NotFoundException(`Resource not found`);
        }
        if (
          axiosError.response?.status === HttpStatusCode.Forbidden ||
          axiosError.response?.status === HttpStatusCode.Unauthorized
        ) {
          throw new ForbiddenException(`Resource not authorized`);
        }
        if (
          axiosError.response?.status === HttpStatusCode.RequestTimeout ||
          axiosError.response?.status === HttpStatusCode.GatewayTimeout ||
          axiosError.code === 'ECONNABORTED'
        ) {
          throw new RequestTimeoutException(`Resource timed out`);
        }
      }

      throw new BadRequestException(error, `Failed to download context resource`);
    }
  }
}
