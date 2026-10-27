import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {
  DIST_DIR,
  IS_PRODUCTION,
  PORT,
  ROOT_DIR,
} from './config.js';
import { ensureSchema, pool } from './db.js';
import { AppError, errorPayload } from './errors.js';
import { apiRouter } from './routes.js';

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PRODUCTION) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
      ].join('; '),
    );
  }
  next();
});

app.use(express.json({ limit: '256kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiRouter);

const indexFile = path.join(DIST_DIR, 'index.html');
const hasBuiltFrontend = fs.existsSync(indexFile);

if (hasBuiltFrontend) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      etag: true,
      maxAge: '1h',
    }),
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile, (error) => {
      if (error) next(error);
    });
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send(
      'PhraseGrow API 正在运行。\n开发模式前端：pnpm dev:web\n生产构建：pnpm build && pnpm start',
    );
  });
}

app.use((req, res) => {
  res.status(404).json(
    errorPayload(new AppError(404, 'NOT_FOUND', '页面不存在。')),
  );
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json(
      errorPayload(new AppError(400, 'INVALID_JSON', '请求内容不是有效的 JSON。')),
    );
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json(errorPayload(error));
    return;
  }

  console.error('[server] Unhandled request error:', error);
  res.status(500).json(
    errorPayload(
      new AppError(500, 'INTERNAL_ERROR', '服务器开小差了，请稍后再试。'),
    ),
  );
});

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

async function start() {
  await ensureSchema();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  󰗊 PhraseGrow 词芽已启动`);
    console.log(`  本机访问:  http://localhost:${PORT}`);
    const lan = getLanAddress();
    if (lan) {
      console.log(`  手机访问:  http://${lan}:${PORT}  (需在同一局域网)`);
    }
    console.log(
      `  前端资源:  ${hasBuiltFrontend ? '已加载生产构建' : '尚未构建，请运行 pnpm dev'}\n`,
    );
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error) => {
  console.error('\n[server] Startup failed:', error.message);
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    console.error('[server] 请检查 DATABASE_URL 与网络连接。');
  }
  await pool.end().catch(() => {});
  process.exit(1);
});

export { app, ROOT_DIR };
