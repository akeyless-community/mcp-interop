import { SignJWT } from 'jose';
import type { Response } from 'express';
import { AuthError, normalizeBearerToken, verifyAccessToken } from './auth';
import { loadConfigForTest } from './config';
import { buildUnauthorizedResponse, normalizeBearerTokenForTest } from './http';
import { buildOprmDocument, buildWwwAuthenticateHeader } from './oprm';

describe('normalizeBearerToken', () => {
  it('strips repeated Bearer prefixes', () => {
    expect(normalizeBearerToken('abc')).toBe('abc');
    expect(normalizeBearerToken('Bearer abc')).toBe('abc');
    expect(normalizeBearerTokenForTest('Bearer Bearer abc')).toBe('abc');
  });
});

describe('OPRM', () => {
  const config = loadConfigForTest({
    resource: 'http://127.0.0.1:8790/mcp',
    resourceMetadataUrl: 'http://127.0.0.1:8790/.well-known/oauth-protected-resource',
    authorizationServers: ['https://auth.example.com'],
    scopes: ['mcp:tools'],
  });

  it('builds RFC 9728 metadata with authorization_servers and scopes', () => {
    expect(buildOprmDocument(config)).toEqual({
      resource: 'http://127.0.0.1:8790/mcp',
      authorization_servers: ['https://auth.example.com'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp:tools'],
      resource_documentation:
        'https://openid.net/wp-content/uploads/2026/07/Gartner-IAM-Summit-MCP-Security-Interop-1.pdf',
    });
  });

  it('includes resource_metadata and scope in WWW-Authenticate', () => {
    const header = buildWwwAuthenticateHeader(config);
    expect(header).toContain('Bearer');
    expect(header).toContain(
      'resource_metadata="http://127.0.0.1:8790/.well-known/oauth-protected-resource"',
    );
    expect(header).toContain('scope="mcp:tools"');
  });
});

describe('buildUnauthorizedResponse', () => {
  it('returns 401 with OPRM discovery headers', () => {
    const config = loadConfigForTest({});
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    buildUnauthorizedResponse(res, config);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(headers['www-authenticate']).toContain('resource_metadata=');
    expect(headers['www-authenticate']).toContain('scope=');
  });
});

describe('verifyAccessToken', () => {
  const secret = 'test-secret-do-not-use-in-prod';
  const config = loadConfigForTest({
    jwtSecret: secret,
    jwtIssuer: 'https://auth.example.com',
    jwtAudience: 'http://127.0.0.1:8790/mcp',
    scopes: ['mcp:tools'],
  });

  async function mintToken(claims: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT({
      scope: 'mcp:tools',
      ...claims,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://auth.example.com')
      .setAudience('http://127.0.0.1:8790/mcp')
      .setExpirationTime('2h')
      .sign(new TextEncoder().encode(secret));
  }

  it('accepts a valid Bearer JWT', async () => {
    const token = await mintToken();
    const payload = await verifyAccessToken(`Bearer ${token}`, config);
    expect(payload.iss).toBe('https://auth.example.com');
  });

  it('rejects missing token', async () => {
    await expect(verifyAccessToken(undefined, config)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects token without required scope', async () => {
    const token = await mintToken({ scope: 'openid' });
    await expect(verifyAccessToken(token, config)).rejects.toThrow(/scope/i);
  });
});
