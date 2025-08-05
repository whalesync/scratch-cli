import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { WSLogger, WSLoggerShim } from './logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*', // Allow any origin for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Cache-Control'],
    credentials: true,
  });

  // Apply global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useLogger(new WSLoggerShim());
  const port = process.env.PORT ?? 3010;
  WSLogger.info({ source: 'main', message: `Listening on port: ${port}` });
  await app.listen(port);
}
void bootstrap();
