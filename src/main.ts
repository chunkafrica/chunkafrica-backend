import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PRODUCTION_FRONTEND_ORIGIN = 'https://chunkafrica.vercel.app';
const LOCAL_FRONTEND_ORIGINS = new Set([
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]);
const VERCEL_PREVIEW_ORIGIN_PATTERN = /^https:\/\/chunkafrica(?:-[^.]+)?\.vercel\.app$/;

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '');
}

function resolveAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  return new Set([
    PRODUCTION_FRONTEND_ORIGIN,
    ...LOCAL_FRONTEND_ORIGINS,
    ...configuredOrigins,
  ]);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = resolveAllowedOrigins();

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      const isAllowedOrigin =
        allowedOrigins.has(normalizedOrigin) ||
        VERCEL_PREVIEW_ORIGIN_PATTERN.test(normalizedOrigin);

      callback(isAllowedOrigin ? null : new Error('Origin not allowed by CORS'), isAllowedOrigin);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
