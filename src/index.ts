#!/usr/bin/env node

import { runHttpServer } from './http';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  await runHttpServer(config);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[akeyless-openid-mcp-interop] fatal: ${message}\n`);
  process.exit(1);
});
