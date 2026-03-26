import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  ChannelListResponse,
  PlaylistItemListResponse,
} from "../types/youtube.js";
import { youtubeApiFetch } from "../utils/youtube-api.js";
import { resolveChannelId } from "../utils/extractors.js";

export function registerChannelTools(server: McpServer): void {
  // --- list_channel_videos ---
  server.registerTool(
    "list_channel_videos",
    {
      title: "List Channel Videos",
      description:
        "Get the most recent uploads from a YouTube channel. " +
        "Accepts channel IDs (UC...), channel URLs, or @handle format.",
      inputSchema: {
        channel_id: z
          .string()
          .describe(
            "YouTube channel ID (UC...), channel URL, or @handle"
          ),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Number of videos to return (1-50)"),
        order: z
          .enum(["date", "relevance", "viewCount", "rating"])
          .default("date")
          .describe("Sort order"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ channel_id, max_results, order }) => {
      try {
        const resolvedId = await resolveChannelId(channel_id);

        // Get uploads playlist ID
        const channelData =
          await youtubeApiFetch<ChannelListResponse>("channels", {
            id: resolvedId,
            part: "contentDetails",
          });

        const uploadsPlaylistId =
          channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find uploads playlist for channel: ${resolvedId}`,
              },
            ],
            isError: true,
          };
        }

        // Get playlist items
        const playlistData =
          await youtubeApiFetch<PlaylistItemListResponse>(
            "playlistItems",
            {
              playlistId: uploadsPlaylistId,
              part: "snippet,contentDetails",
              maxResults: String(max_results),
            }
          );

        if (
          !playlistData.items ||
          playlistData.items.length === 0
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No videos found for channel: ${resolvedId}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Recent Videos from Channel`,
          "",
          `Showing ${playlistData.items.length} of ${playlistData.pageInfo.totalResults} uploads`,
          "",
        ];

        for (const item of playlistData.items) {
          const videoId =
            item.snippet.resourceId?.videoId ??
            item.contentDetails?.videoId ??
            "unknown";
          lines.push(`## ${item.snippet.title}`);
          lines.push(`- **Video ID**: ${videoId}`);
          lines.push(`- **Published**: ${item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt}`);
          if (item.snippet.description) {
            const desc =
              item.snippet.description.length > 200
                ? item.snippet.description.slice(0, 200) + "..."
                : item.snippet.description;
            lines.push(`- **Description**: ${desc}`);
          }
          if (item.snippet.thumbnails?.high) {
            lines.push(
              `- **Thumbnail**: ${item.snippet.thumbnails.high.url}`
            );
          }
          lines.push("");
        }

        if (playlistData.nextPageToken) {
          lines.push(
            `*More videos available (next page token: ${playlistData.nextPageToken})*`
          );
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- Post-MVP Stubs ---

  server.registerTool(
    "get_channel_details",
    {
      title: "Get Channel Details",
      description:
        "Get channel metadata including snippet, statistics, and branding settings. (Post-MVP — not yet implemented)",
      inputSchema: {
        channel_id: z.string().describe("YouTube channel ID, URL, or @handle"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement full channel details retrieval
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
    "list_channel_playlists",
    {
      title: "List Channel Playlists",
      description:
        "List all playlists for a YouTube channel. (Post-MVP — not yet implemented)",
      inputSchema: {
        channel_id: z.string().describe("YouTube channel ID, URL, or @handle"),
        max_results: z.number().int().min(1).max(50).default(10).describe("Number of playlists"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement playlist listing
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
    "get_channel_stats",
    {
      title: "Get Channel Stats",
      description:
        "Quick subscriber, video, and view counts for a channel. (Post-MVP — not yet implemented)",
      inputSchema: {
        channel_id: z.string().describe("YouTube channel ID, URL, or @handle"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    // TODO: Post-MVP — implement channel stats
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
