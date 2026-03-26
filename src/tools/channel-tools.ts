import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  ChannelListResponse,
  PlaylistItemListResponse,
  PlaylistListResponse,
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

  // --- get_channel_details ---
  server.registerTool(
    "get_channel_details",
    {
      title: "Get Channel Details",
      description:
        "Get channel metadata including description, subscriber count, video count, and branding. " +
        "Accepts channel IDs (UC...), channel URLs, or @handle format.",
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
    async ({ channel_id }) => {
      try {
        const resolvedId = await resolveChannelId(channel_id);

        const data = await youtubeApiFetch<ChannelListResponse>("channels", {
          id: resolvedId,
          part: "snippet,statistics,brandingSettings,contentDetails",
        });

        const ch = data.items?.[0];
        if (!ch) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Channel not found: ${resolvedId}`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`## ${ch.snippet?.title ?? ch.id}`);
        lines.push("");

        if (ch.snippet) {
          if (ch.snippet.customUrl) {
            lines.push(`- **Handle**: ${ch.snippet.customUrl}`);
          }
          lines.push(`- **Channel ID**: ${ch.id}`);
          lines.push(`- **Created**: ${ch.snippet.publishedAt}`);
          if (ch.snippet.country) {
            lines.push(`- **Country**: ${ch.snippet.country}`);
          }
          if (ch.snippet.description) {
            const desc =
              ch.snippet.description.length > 500
                ? ch.snippet.description.slice(0, 500) + "..."
                : ch.snippet.description;
            lines.push(`- **Description**: ${desc}`);
          }
          if (ch.snippet.thumbnails?.high) {
            lines.push(`- **Thumbnail**: ${ch.snippet.thumbnails.high.url}`);
          }
        }

        if (ch.statistics) {
          lines.push("");
          lines.push("### Statistics");
          lines.push(
            `- **Subscribers**: ${ch.statistics.hiddenSubscriberCount ? "Hidden" : Number(ch.statistics.subscriberCount).toLocaleString()}`
          );
          lines.push(
            `- **Total Views**: ${Number(ch.statistics.viewCount).toLocaleString()}`
          );
          lines.push(
            `- **Videos**: ${Number(ch.statistics.videoCount).toLocaleString()}`
          );
        }

        if (ch.brandingSettings?.image?.bannerExternalUrl) {
          lines.push("");
          lines.push(
            `- **Banner**: ${ch.brandingSettings.image.bannerExternalUrl}`
          );
        }

        if (ch.contentDetails?.relatedPlaylists?.uploads) {
          lines.push("");
          lines.push(
            `- **Uploads Playlist**: ${ch.contentDetails.relatedPlaylists.uploads}`
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

  // --- get_channel_stats ---
  server.registerTool(
    "get_channel_stats",
    {
      title: "Get Channel Stats",
      description:
        "Quick subscriber, video, and view counts for a channel. " +
        "Accepts channel IDs (UC...), channel URLs, or @handle format.",
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
    async ({ channel_id }) => {
      try {
        const resolvedId = await resolveChannelId(channel_id);

        const data = await youtubeApiFetch<ChannelListResponse>("channels", {
          id: resolvedId,
          part: "snippet,statistics",
        });

        const ch = data.items?.[0];
        if (!ch) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Channel not found: ${resolvedId}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# ${ch.snippet?.title ?? ch.id}`,
          "",
        ];

        if (ch.statistics) {
          lines.push(
            `- Subscribers: ${ch.statistics.hiddenSubscriberCount ? "Hidden" : Number(ch.statistics.subscriberCount).toLocaleString()}`
          );
          lines.push(
            `- Total Views: ${Number(ch.statistics.viewCount).toLocaleString()}`
          );
          lines.push(
            `- Videos: ${Number(ch.statistics.videoCount).toLocaleString()}`
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

  // --- list_channel_playlists ---
  server.registerTool(
    "list_channel_playlists",
    {
      title: "List Channel Playlists",
      description:
        "List all public playlists for a YouTube channel. " +
        "Accepts channel IDs (UC...), channel URLs, or @handle format.",
      inputSchema: {
        channel_id: z.string().describe("YouTube channel ID, URL, or @handle"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Number of playlists to return (1-50)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ channel_id, max_results }) => {
      try {
        const resolvedId = await resolveChannelId(channel_id);

        const data = await youtubeApiFetch<PlaylistListResponse>("playlists", {
          channelId: resolvedId,
          part: "snippet,contentDetails",
          maxResults: String(max_results),
        });

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No public playlists found for channel: ${resolvedId}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Playlists`,
          "",
          `Showing ${data.items.length} of ${data.pageInfo.totalResults} playlists`,
          "",
        ];

        for (const pl of data.items) {
          lines.push(`## ${pl.snippet?.title ?? pl.id}`);
          lines.push(`- **Playlist ID**: ${pl.id}`);
          if (pl.contentDetails?.itemCount !== undefined) {
            lines.push(`- **Videos**: ${pl.contentDetails.itemCount}`);
          }
          if (pl.snippet?.publishedAt) {
            lines.push(`- **Created**: ${pl.snippet.publishedAt}`);
          }
          if (pl.snippet?.description) {
            const desc =
              pl.snippet.description.length > 200
                ? pl.snippet.description.slice(0, 200) + "..."
                : pl.snippet.description;
            lines.push(`- **Description**: ${desc}`);
          }
          if (pl.snippet?.thumbnails?.high) {
            lines.push(`- **Thumbnail**: ${pl.snippet.thumbnails.high.url}`);
          }
          lines.push("");
        }

        if (data.nextPageToken) {
          lines.push(
            `*More playlists available (next page token: ${data.nextPageToken})*`
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
}
