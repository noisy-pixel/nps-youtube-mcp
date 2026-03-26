import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPlaylistTools(server: McpServer): void {
  // --- Post-MVP Stubs ---

  server.registerTool(
    "list_playlist_items",
    {
      title: "List Playlist Items",
      description:
        "Get all videos in a playlist with metadata. (Post-MVP — not yet implemented)",
      inputSchema: {
        playlist_id: z.string().describe("YouTube playlist ID"),
        max_results: z.number().int().min(1).max(50).default(20).describe("Number of items"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement playlist items listing
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "This tool is not yet implemented. It will be available in a future version.",
          },
        ],
        isError: true,
      };
    }
  );

  server.registerTool(
    "get_playlist_details",
    {
      title: "Get Playlist Details",
      description:
        "Get playlist title, description, and item count. (Post-MVP — not yet implemented)",
      inputSchema: {
        playlist_id: z.string().describe("YouTube playlist ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement playlist details
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "This tool is not yet implemented. It will be available in a future version.",
          },
        ],
        isError: true,
      };
    }
  );

  server.registerTool(
    "get_playlist_transcripts",
    {
      title: "Get Playlist Transcripts",
      description:
        "Bulk-fetch transcripts for all videos in a playlist. (Post-MVP — not yet implemented)",
      inputSchema: {
        playlist_id: z.string().describe("YouTube playlist ID"),
        lang: z.string().default("en").describe("Preferred language code"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement bulk transcript fetching
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: "This tool is not yet implemented. It will be available in a future version.",
          },
        ],
        isError: true,
      };
    }
  );
}
