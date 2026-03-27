#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVideoTools } from "./tools/video-tools.js";
import { registerTranscriptTools } from "./tools/transcript-tools.js";
import { registerChannelTools } from "./tools/channel-tools.js";
import { registerPlaylistTools } from "./tools/playlist-tools.js";

// Route CLI subcommands before starting the MCP server
const subcommand = process.argv[2];

if (subcommand === "setup") {
  const { runSetup } = await import("./setup.js");
  await runSetup(process.argv.slice(3));
  process.exit(0);
}

const server = new McpServer({
  name: "nps-youtube-mcp",
  version: "0.5.1",
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
