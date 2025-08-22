export class ExternalContent {
  url: string;
  contentType: 'markdown' | 'json' | 'text';
  content: string;

  constructor(url: string, contentType: 'markdown' | 'json' | 'text', content: string) {
    this.url = url;
    this.contentType = contentType;
    this.content = content;
  }
}
