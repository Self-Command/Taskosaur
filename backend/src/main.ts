import { config as loadEnv } from 'dotenv';
loadEnv(); // must run BEFORE NestFactory so CORS can read env vars

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { execSync } from 'child_process';
import * as express from 'express';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  createStaticRoutingMiddleware,
  findPublicDir,
} from './middleware/static-routing.middleware';
import { RequestContextInterceptor } from './common/request-context.interceptor';
import * as cookieParser from 'cookie-parser';

// Suppress unhandled promise rejections from Redis connection failures
process.on('unhandledRejection', (reason: unknown) => {
  // Ignore Redis connection errors when Redis is unavailable
  if (
    reason &&
    typeof reason === 'object' &&
    (('code' in reason && reason.code === 'ECONNREFUSED') ||
      ('syscall' in reason && reason.syscall === 'connect') ||
      ('message' in reason &&
        typeof reason.message === 'string' &&
        reason.message.includes('ECONNREFUSED')))
  ) {
    return; // Silently ignore - fallback queue is being used
  }
  // Log other unhandled rejections
  console.error('Unhandled Rejection:', reason);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Auto-run database migrations on startup
  try {
    logger.log('Running database migrations...');
    execSync('node node_modules/prisma/build/index.js migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, PRISMA_HIDE_UPDATE_PROMPT: 'true' },
    });
    logger.log('Database migrations completed');
  } catch (err: any) {
    const msg = err.stderr || err.message || '';
    if (msg.includes('P1001') || msg.includes('ECONNREFUSED')) {
      logger.warn('Database not available — migrations skipped');
    } else if (msg.includes('no migration')) {
      logger.log('No pending migrations');
    } else {
      logger.warn(`Migration issue: ${msg.slice(0, 200)}`);
    }
  }

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id', 'X-Requested-With'],
      credentials: true,
    },
  });
  const configService = app.get(ConfigService);

  const appConfig = configService.get('app');

  // Log ALL incoming requests for debugging
  app.use((req: any, _res: any, next: any) => {
    if (req.url.startsWith('/mcp')) {
      console.log(
        `[HTTP] ${req.method} ${req.url} from ${req.ip} — Accept=${req.headers.accept || '-'} Content-Type=${req.headers['content-type'] || '-'} Auth=${(req.headers.authorization || '').slice(0, 20)}... Session=${(req.headers['mcp-session-id'] || '-').slice(0, 12)}`,
      );
    }
    next();
  });

  // Increase body parser limits for AI chat and large payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Enable cookie parsing for OIDC state management
  app.use(cookieParser());

  // Enable ValidationPipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Get port and host from config
  const port = appConfig.port;
  const host = appConfig.host || '0.0.0.0';

  // Serve static files from public directory (JS, CSS, images, etc.)
  const publicDir = findPublicDir();
  app.use(express.static(publicDir));
  app.useGlobalInterceptors(new RequestContextInterceptor());
  // Serve Next.js static HTML files and handle dynamic routing
  app.use(createStaticRoutingMiddleware(publicDir));

  // Configure Swagger documentation
  const swaggerConfig = appConfig.swagger;
  const swaggerOptions = new DocumentBuilder()
    .setTitle(swaggerConfig.title as string)
    .setDescription(swaggerConfig.description as string)
    .setVersion(swaggerConfig.version as string)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer(`http://${host}:${port}`, 'Development server')
    .addServer('https://api.taskosaur.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);

  // Setup Swagger UI at /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // ── Redis persistence check ──
  // Task reminders (BullMQ) rely on Redis for delayed job persistence.
  // Without AOF+RDB, reminders are lost on Redis restart. Auto-enable AOF on boot.
  try {
    const { createClient } = require('redis');
    const redisCli = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      socket: { connectTimeout: 3000, rejectUnauthorized: false },
    });
    redisCli.on('error', () => {});
    await redisCli.connect();
    const cfg = await redisCli.configGet('appendonly');
    const save = await redisCli.configGet('save');
    if (cfg.appendonly === 'no') {
      await redisCli.configSet('appendonly', 'yes');
      logger.log('[Redis] AOF 持久化自动开启 (防止提醒任务丢失)');
    }
    logger.log(`[Redis] RDB=${JSON.stringify(save.save)} AOF=${cfg.appendonly === 'yes' ? 'yes' : 'enabled'}`);
    await redisCli.quit();
  } catch {
    logger.warn('[Redis] 连接失败，跳过持久化检查。提醒任务可能在 Redis 重启后丢失。');
  }

  await app.listen(port as string | number, host as string);
  logger.log(`Application is running on: http://${host}:${port}`);
  logger.log(
    `Swagger documentation available at: http://${host}:${port}/${swaggerConfig.path as string}`,
  );
}
void bootstrap();
