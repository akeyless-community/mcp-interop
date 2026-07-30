/**
 * Configuration for the OpenID AIIM Track A MCP Server interop surface.
 *
 * Env vars use INTEROP_* prefix so this can run beside other connectors.
 */

export interface InteropConfig {
  httpHost: string;
  httpPort: number;
  httpPath: string;
  /** Canonical resource identifier advertised in OPRM (RFC 9728). */
  resource: string;
  /** Absolute URL of this server's OPRM document. */
  resourceMetadataUrl: string;
  /** Authorization server issuer identifiers trusted by this resource. */
  authorizationServers: string[];
  /** Scopes advertised and required for MCP access. */
  scopes: string[];
  /** Expected JWT iss claim (optional if using JWKS-only discovery). */
  jwtIssuer?: string;
  /** Expected JWT aud / resource claim. */
  jwtAudience: string;
  /** JWKS URI for access-token signature verification. */
  jwksUri?: string;
  /**
   * Optional HS256 shared secret for local/demo tokens when no JWKS is configured.
   * Do not use in partner interop against a real AS.
   */
  jwtSecret?: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid INTEROP_HTTP_PORT: ${raw}`);
  }
  return port;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Builds runtime config from environment variables.
 *
 * Required:
 * - INTEROP_RESOURCE (e.g. http://localhost:8790/mcp)
 * - INTEROP_AUTHORIZATION_SERVERS (comma-separated issuer URLs)
 * - INTEROP_JWT_AUDIENCE (usually same as INTEROP_RESOURCE)
 *
 * Auth verification (one of):
 * - INTEROP_JWKS_URI
 * - INTEROP_JWT_SECRET (local/demo only)
 */
export function loadConfig(overrides: Partial<InteropConfig> = {}): InteropConfig {
  const httpHost = overrides.httpHost ?? readEnv('INTEROP_HTTP_HOST') ?? '0.0.0.0';
  const httpPort = overrides.httpPort ?? parsePort(readEnv('INTEROP_HTTP_PORT'), 8790);
  const httpPath = overrides.httpPath ?? readEnv('INTEROP_HTTP_PATH') ?? '/mcp';

  const resource =
    overrides.resource ??
    readEnv('INTEROP_RESOURCE') ??
    `http://127.0.0.1:${httpPort}${httpPath}`;

  const publicBase =
    readEnv('INTEROP_PUBLIC_BASE_URL') ??
    resource.replace(new RegExp(`${httpPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');

  const resourceMetadataUrl =
    overrides.resourceMetadataUrl ??
    readEnv('INTEROP_RESOURCE_METADATA_URL') ??
    joinUrl(publicBase || `http://127.0.0.1:${httpPort}`, '/.well-known/oauth-protected-resource');

  const authorizationServers =
    overrides.authorizationServers ??
    parseCsv(readEnv('INTEROP_AUTHORIZATION_SERVERS'));

  if (authorizationServers.length === 0 && !overrides.authorizationServers) {
    throw new Error(
      'INTEROP_AUTHORIZATION_SERVERS is required (comma-separated issuer URLs).',
    );
  }

  const scopes =
    overrides.scopes ??
    parseCsv(readEnv('INTEROP_SCOPES') ?? 'mcp:tools');

  const jwtAudience =
    overrides.jwtAudience ?? readEnv('INTEROP_JWT_AUDIENCE') ?? resource;

  const jwtIssuer = overrides.jwtIssuer ?? readEnv('INTEROP_JWT_ISSUER');
  const jwksUri = overrides.jwksUri ?? readEnv('INTEROP_JWKS_URI');
  const jwtSecret = overrides.jwtSecret ?? readEnv('INTEROP_JWT_SECRET');

  if (!jwksUri && !jwtSecret) {
    throw new Error(
      'Configure INTEROP_JWKS_URI (partner AS) or INTEROP_JWT_SECRET (local demo only).',
    );
  }

  return {
    httpHost,
    httpPort,
    httpPath,
    resource,
    resourceMetadataUrl,
    authorizationServers,
    scopes,
    jwtIssuer,
    jwtAudience,
    jwksUri,
    jwtSecret,
  };
}

/** Test helper that skips env validation. */
export function loadConfigForTest(partial: Partial<InteropConfig>): InteropConfig {
  return {
    httpHost: '127.0.0.1',
    httpPort: 8790,
    httpPath: '/mcp',
    resource: 'http://127.0.0.1:8790/mcp',
    resourceMetadataUrl: 'http://127.0.0.1:8790/.well-known/oauth-protected-resource',
    authorizationServers: ['https://auth.example.com'],
    scopes: ['mcp:tools'],
    jwtAudience: 'http://127.0.0.1:8790/mcp',
    jwtSecret: 'test-secret-do-not-use-in-prod',
    ...partial,
  };
}

export function requireEnvForDocs(): string[] {
  return [
    'INTEROP_RESOURCE',
    'INTEROP_AUTHORIZATION_SERVERS',
    'INTEROP_JWT_AUDIENCE',
    'INTEROP_JWKS_URI or INTEROP_JWT_SECRET',
  ];
}
