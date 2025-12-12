import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import Parser from '@postlight/parser';
import {
  createStyleGuideId,
  StyleGuideId,
  UpdateStyleGuideDto,
  ValidatedCreateStyleGuideDto,
} from '@spinner/shared-types';
import axios, { AxiosError, HttpStatusCode } from 'axios';
import { AuditLogService } from 'src/audit/audit-log.service';
import { WSLogger } from 'src/logger';
import { Actor } from 'src/users/types';
import { isValidHttpUrl } from 'src/utils/urls';
import { DbService } from '../db/db.service';
import { PostHogService } from '../posthog/posthog.service';
import { ExternalContent } from './entities/external-content.entity';
import { StyleGuide } from './entities/style-guide.entity';

@Injectable()
export class StyleGuideService {
  constructor(
    private readonly db: DbService,
    private readonly posthogService: PostHogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createStyleGuideDto: ValidatedCreateStyleGuideDto, actor: Actor): Promise<StyleGuide> {
    // Sanitize the DTO.
    if (createStyleGuideDto.sourceUrl) {
      createStyleGuideDto.sourceUrl = this.sanitizeUrl(createStyleGuideDto.sourceUrl);
    }

    const styleGuide = await this.db.client.styleGuide.create({
      data: {
        id: createStyleGuideId(),
        ...createStyleGuideDto,
        userId: actor.userId,
        organizationId: actor.organizationId,
      },
    });

    this.posthogService.trackCreateResource(actor.userId, styleGuide);
    await this.auditLogService.logEvent({
      actor,
      eventType: 'create',
      message: `Created resource ${styleGuide.name}`,
      entityId: styleGuide.id as StyleGuideId,
      context: {
        sourceUrl: styleGuide.sourceUrl,
        contentType: styleGuide.contentType,
      },
    });
    return new StyleGuide(styleGuide);
  }

  async findAll(actor: Actor): Promise<StyleGuide[]> {
    const styleGuides = await this.db.client.styleGuide.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { updatedAt: 'desc' },
    });

    return styleGuides.map((styleGuide) => new StyleGuide(styleGuide));
  }

  async findOne(id: string, actor: Actor): Promise<StyleGuide | null> {
    const styleGuide = await this.db.client.styleGuide.findFirst({
      where: { id, organizationId: actor.organizationId },
    });

    return styleGuide ? new StyleGuide(styleGuide) : null;
  }

  async update(id: string, updateStyleGuideDto: UpdateStyleGuideDto, actor: Actor): Promise<StyleGuide | null> {
    // Sanitize the DTO.
    if (updateStyleGuideDto.sourceUrl) {
      updateStyleGuideDto.sourceUrl = this.sanitizeUrl(updateStyleGuideDto.sourceUrl);
    }

    const styleGuide = await this.db.client.styleGuide.updateMany({
      where: { id, organizationId: actor.organizationId },
      data: updateStyleGuideDto,
    });

    if (styleGuide.count === 0) {
      return null;
    }

    const updatedStyleGuide = await this.db.client.styleGuide.findUnique({
      where: { id },
    });

    if (!updatedStyleGuide) {
      return null;
    }

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Updated resource ${updatedStyleGuide.name}`,
      entityId: updatedStyleGuide.id as StyleGuideId,
      context: {
        changedFields: Object.keys(updateStyleGuideDto),
      },
    });

    return new StyleGuide(updatedStyleGuide);
  }

  async remove(id: string, actor: Actor): Promise<boolean> {
    const styleGuide = await this.findOne(id, actor);
    if (!styleGuide) {
      return false;
    }

    const result = await this.db.client.styleGuide.deleteMany({
      where: { id, organizationId: actor.organizationId },
    });

    if (result.count > 0) {
      this.posthogService.trackRemoveResource(actor.userId, styleGuide);
      await this.auditLogService.logEvent({
        actor,
        eventType: 'delete',
        message: `Deleted resource ${styleGuide.name}`,
        entityId: styleGuide.id as StyleGuideId,
      });
    }

    return result.count > 0;
  }

  async updateExternalResource(id: string, actor: Actor): Promise<StyleGuide | null> {
    const styleGuide = await this.findOne(id, actor);
    if (!styleGuide) {
      return null;
    }

    if (!styleGuide.sourceUrl) {
      throw new Error(`Resource ${id} does not have a source URL`);
    }

    const { content, contentType } = await this.downloadResource(styleGuide.sourceUrl);

    return this.update(id, { body: content, contentType }, actor);
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
          'User-Agent': 'Scratchpaper/1.0 (compatible; ScratchpaperDownloader/1.0)',
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
        // Convert the HTML to Markdown.
        const result = await Parser.parse(url, { contentType: 'markdown', html: contentString });

        return {
          url: sanitizedUrl,
          content: result.content ?? '',
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
