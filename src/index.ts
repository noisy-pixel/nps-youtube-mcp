#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVideoTools } from "./tools/video-tools.js";
import { registerTranscriptTools } from "./tools/transcript-tools.js";
import { registerChannelTools } from "./tools/channel-tools.js";
import { registerPlaylistTools } from "./tools/playlist-tools.js";

const server = new McpServer({
  name: "nps-youtube-mcp",
  version: "0.5.0",
});

registerVideoTools(server);
registerTranscriptTools(server);
registerChannelTools(server);
registerPlaylistTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("YouTube MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
