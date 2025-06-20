import { Service } from '@prisma/client';

export abstract class Connector<S extends Service> {
  readonly service: S;

  abstract testConnection(): Promise<void>;
}
