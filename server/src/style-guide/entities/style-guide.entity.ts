/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { StyleGuideCluster } from 'src/db/cluster-types';

export class StyleGuide {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  body: string;
  userId: string;
  autoInclude: boolean;

  constructor(styleGuide: StyleGuideCluster.StyleGuide) {
    this.id = styleGuide.id;
    this.createdAt = styleGuide.createdAt;
    this.updatedAt = styleGuide.updatedAt;
    this.name = styleGuide.name;
    this.body = styleGuide.body;
    this.userId = styleGuide.userId;
    this.autoInclude = styleGuide.autoInclude;
  }
}
