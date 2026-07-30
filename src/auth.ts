import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { InteropConfig } from './config';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function normalizeBearerToken(raw: string | undefined): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  let token = raw.trim();
  while (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice('Bearer '.length).trim();
  }
  return token || undefined;
}

function tokenHasRequiredScope(payload: JWTPayload, requiredScopes: string[]): boolean {
  if (requiredScopes.length === 0) {
    return true;
  }

  const scopeClaim = payload.scope;
  const scopes =
    typeof scopeClaim === 'string'
      ? scopeClaim.split(/\s+/).filter(Boolean)
      : Array.isArray(payload.scp)
        ? payload.scp.map(String)
        : [];

  return requiredScopes.every((required) => scopes.includes(required));
}

/**
 * Validates a Bearer access token as a JWT.
 * Checks signature (JWKS or HS256 secret), issuer (if set), audience, and required scopes.
 */
export async function verifyAccessToken(
  token: string | undefined,
  config: InteropConfig,
): Promise<JWTPayload> {
  const normalized = normalizeBearerToken(token);
  if (!normalized) {
    throw new AuthError('Missing Bearer access token');
  }

  const options = {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  };

  try {
    let payload: JWTPayload;

    if (config.jwksUri) {
      const jwks = createRemoteJWKSet(new URL(config.jwksUri));
      ({ payload } = await jwtVerify(normalized, jwks, options));
    } else if (config.jwtSecret) {
      const secret = new TextEncoder().encode(config.jwtSecret);
      ({ payload } = await jwtVerify(normalized, secret, options));
    } else {
      throw new AuthError('No JWKS URI or JWT secret configured');
    }

    if (!tokenHasRequiredScope(payload, config.scopes)) {
      throw new AuthError(
        `Token missing required scope(s): ${config.scopes.join(' ')}`,
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AuthError(`Invalid access token: ${message}`);
  }
}
