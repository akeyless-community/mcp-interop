import type { InteropConfig } from './config';

/** RFC 9728 OAuth 2.0 Protected Resource Metadata document. */
export interface OprmDocument {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
  resource_documentation?: string;
}

export function buildOprmDocument(config: InteropConfig): OprmDocument {
  return {
    resource: config.resource,
    authorization_servers: config.authorizationServers,
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopes,
    resource_documentation:
      'https://openid.net/wp-content/uploads/2026/07/Gartner-IAM-Summit-MCP-Security-Interop-1.pdf',
  };
}

/**
 * Builds WWW-Authenticate for 401 responses per RFC 9728 Section 5.1.
 * Includes resource_metadata and scope so partner MCP Clients can discover OPRM.
 */
export function buildWwwAuthenticateHeader(config: InteropConfig): string {
  const scope = config.scopes.join(' ');
  const parts = [
    'Bearer',
    'realm="akeyless-openid-mcp"',
    `resource_metadata="${config.resourceMetadataUrl}"`,
  ];
  if (scope) {
    parts.push(`scope="${scope}"`);
  }
  return parts.join(' ');
}
