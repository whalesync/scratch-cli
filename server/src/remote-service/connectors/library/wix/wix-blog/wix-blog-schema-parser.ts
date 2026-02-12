import { sanitizeForTableWsId } from '../../../ids';
import { TablePreview } from '../../../types';

export class WixBlogSchemaParser {
  parseTablePreview(): TablePreview {
    return {
      id: {
        wsId: sanitizeForTableWsId('wix-blog'),
        remoteId: ['wix-blog'],
      },
      displayName: 'Blog Posts',
    };
  }
}
