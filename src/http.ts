import type { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AuthError, normalizeBearerToken, verifyAccessToken } from './auth';
import type { InteropConfig } from './config';
import { loadConfig } from './config';
import { buildOprmDocument, buildWwwAuthenticateHeader } from './oprm';
import { createInteropMcpServer } from './server';

export function normalizeBearerTokenForTest(raw: string | undefined): string | undefined {
  return normalizeBearerToken(raw);
}

export function buildUnauthorizedResponse(res: Response, config: InteropConfig): void {
  res.setHeader('WWW-Authenticate', buildWwwAuthenticateHeader(config));
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message:
        'Unauthorized: obtain an OAuth 2.1 access token from an authorization server listed in OPRM',
    },
    id: null,
  });
}

function ensureMcpAcceptHeader(req: Request): void {
  const accept = req.headers.accept;
  if (
    typeof accept === 'string' &&
    accept.includes('application/json') &&
    accept.includes('text/event-stream')
  ) {
    return;
  }
  req.headers.accept = 'application/json, text/event-stream';
}

function readAuthorizationHeader(req: Request): string | undefined {
  const auth = req.headers.authorization;
  return typeof auth === 'string' ? auth : undefined;
}

export async function createHttpApp(config: InteropConfig) {
  const app = createMcpExpressApp({ host: config.httpHost });
  const oprm = buildOprmDocument(config);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      connector: 'akeyless-openid-mcp-interop',
      role: 'MCP Server',
      transport: 'streamable-http',
      resource: config.resource,
    });
  });

  // RFC 9728 well-known OAuth Protected Resource Metadata
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.type('application/json').json(oprm);
  });

  const authorizeOrReject = async (req: Request, res: Response): Promise<boolean> => {
    try {
      await verifyAccessToken(readAuthorizationHeader(req), config);
      return true;
    } catch (error) {
      if (error instanceof AuthError) {
        buildUnauthorizedResponse(res, config);
        return false;
      }
      throw error;
    }
  };

  const handleMcpPost = async (req: Request, res: Response): Promise<void> => {
    if (!(await authorizeOrReject(req, res))) {
      return;
    }

    ensureMcpAcceptHeader(req);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createInteropMcpServer();

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message },
          id: null,
        });
      }
    }
  };

  const handleMcpGet = async (req: Request, res: Response): Promise<void> => {
    if (!(await authorizeOrReject(req, res))) {
      return;
    }

    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    });
  };

  app.post(config.httpPath, handleMcpPost);
  app.get(config.httpPath, handleMcpGet);

  // Unauthenticated probe on MCP path should also advertise OPRM via 401
  app.use(config.httpPath, (req, res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    next();
  });

  return app;
}

export async function runHttpServer(config?: InteropConfig): Promise<void> {
  const resolved = config ?? loadConfig();
  const app = await createHttpApp(resolved);

  await new Promise<void>((resolve, reject) => {
    app.listen(resolved.httpPort, resolved.httpHost, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  process.stderr.write(
    `[akeyless-openid-mcp-interop] listening on http://${resolved.httpHost}:${resolved.httpPort}${resolved.httpPath}\n`,
  );
  process.stderr.write(
    `[akeyless-openid-mcp-interop] OPRM: ${resolved.resourceMetadataUrl}\n`,
  );

  const shutdown = async () => {
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
