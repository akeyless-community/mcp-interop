import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Minimal MCP tool surface for OpenID Track A OAuth/OPRM testing.
 * Partners only need authenticated tool access to verify the OAuth matrix.
 */
export function createInteropMcpServer(): Server {
  const server = new Server(
    {
      name: 'akeyless-openid-mcp-interop',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'Akeyless OpenID AIIM Track A MCP Server. Use ping after presenting a valid OAuth Bearer token.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ping',
        description:
          'Health check used by OpenID AIIM OAuth interop partners after obtaining a Bearer token.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Optional echo payload',
            },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'ping') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${request.params.name}` }),
          },
        ],
        isError: true,
      };
    }

    const args = (request.params.arguments ?? {}) as { message?: string };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: true,
            server: 'akeyless-openid-mcp-interop',
            role: 'MCP Server',
            standard: 'OAuth 2.1 / OPRM',
            echo: args.message ?? null,
          }),
        },
      ],
    };
  });

  return server;
}
