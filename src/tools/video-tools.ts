import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { VideoListResponse, SearchListResponse } from "../types/youtube.js";
import { youtubeApiFetch } from "../utils/youtube-api.js";
import { extractVideoId, extractMultipleVideoIds } from "../utils/extractors.js";
import { formatDuration } from "../utils/formatters.js";

export function registerVideoTools(server: McpServer): void {
  // --- get_video_details ---
  server.registerTool(
    "get_video_details",
    {
      title: "Get Video Details",
      description:
        "Retrieve metadata and statistics for one or more YouTube videos. " +
        "Accepts video IDs or full YouTube URLs (comma-separated for multiple).",
      inputSchema: {
        video_id: z
          .string()
          .describe("Comma-separated video ID(s) or YouTube URLs"),
        parts: z
          .array(z.string())
          .default(["snippet", "contentDetails", "statistics"])
          .describe("Resource parts to include"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ video_id, parts }) => {
      try {
        const ids = extractMultipleVideoIds(video_id);
        const data = await youtubeApiFetch<VideoListResponse>("videos", {
          id: ids.join(","),
          part: parts.join(","),
        });

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No videos found for ID(s): ${ids.join(", ")}`,
              },
            ],
          };
        }

        const lines: string[] = [];
        for (const video of data.items) {
          lines.push(`## ${video.snippet?.title ?? video.id}`);
          lines.push("");
          if (video.snippet) {
            lines.push(`- **Channel**: ${video.snippet.channelTitle}`);
            lines.push(`- **Published**: ${video.snippet.publishedAt}`);
            if (video.snippet.description) {
              const desc =
                video.snippet.description.length > 300
                  ? video.snippet.description.slice(0, 300) + "..."
                  : video.snippet.description;
              lines.push(`- **Description**: ${desc}`);
            }
            if (video.snippet.tags && video.snippet.tags.length > 0) {
              lines.push(
                `- **Tags**: ${video.snippet.tags.slice(0, 15).join(", ")}`
              );
            }
          }
          if (video.contentDetails?.duration) {
            lines.push(
              `- **Duration**: ${formatDuration(video.contentDetails.duration)}`
            );
          }
          if (video.statistics) {
            lines.push(
              `- **Views**: ${Number(video.statistics.viewCount).toLocaleString()}`
            );
            lines.push(
              `- **Likes**: ${Number(video.statistics.likeCount).toLocaleString()}`
            );
            lines.push(
              `- **Comments**: ${Number(video.statistics.commentCount).toLocaleString()}`
            );
          }
          if (video.snippet?.thumbnails?.high) {
            lines.push(
              `- **Thumbnail**: ${video.snippet.thumbnails.high.url}`
            );
          }
          lines.push("");
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

  // --- search_videos ---
  server.registerTool(
    "search_videos",
    {
      title: "Search Videos",
      description:
        "Search YouTube for videos matching a query. Returns video IDs, titles, channels, and publication dates.",
      inputSchema: {
        query: z.string().min(1).describe("Search query text"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe("Number of results (1-50)"),
        order: z
          .enum(["relevance", "date", "viewCount", "rating"])
          .default("relevance")
          .describe("Sort order"),
        channel_id: z
          .string()
          .optional()
          .describe("Restrict search to a specific channel ID"),
        published_after: z
          .string()
          .optional()
          .describe("ISO 8601 datetime — only return videos published after this date"),
        published_before: z
          .string()
          .optional()
          .describe("ISO 8601 datetime — only return videos published before this date"),
        type: z
          .enum(["video", "channel", "playlist"])
          .default("video")
          .describe("Resource type filter"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, max_results, order, channel_id, published_after, published_before, type }) => {
      try {
        const params: Record<string, string> = {
          q: query,
          type,
          maxResults: String(max_results),
          order,
          part: "snippet",
        };
        if (channel_id) params.channelId = channel_id;
        if (published_after) params.publishedAfter = published_after;
        if (published_before) params.publishedBefore = published_before;

        const data = await youtubeApiFetch<SearchListResponse>(
          "search",
          params
        );

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No results found for "${query}".`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Search Results for "${query}"`,
          "",
          `Found ${data.pageInfo.totalResults} total results (showing ${data.items.length})`,
          "",
        ];

        for (const item of data.items) {
          const id =
            item.id.videoId ?? item.id.channelId ?? item.id.playlistId ?? "unknown";
          const typeLabel =
            item.id.videoId
              ? "Video"
              : item.id.channelId
                ? "Channel"
                : "Playlist";

          lines.push(`## ${item.snippet.title}`);
          lines.push(`- **${typeLabel} ID**: ${id}`);
          lines.push(`- **Channel**: ${item.snippet.channelTitle}`);
          lines.push(`- **Published**: ${item.snippet.publishedAt}`);
          if (item.snippet.description) {
            lines.push(`- **Description**: ${item.snippet.description}`);
          }
          if (item.snippet.thumbnails?.high) {
            lines.push(
              `- **Thumbnail**: ${item.snippet.thumbnails.high.url}`
            );
          }
          lines.push("");
        }

        if (data.nextPageToken) {
          lines.push(
            `*More results available (next page token: ${data.nextPageToken})*`
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

  // --- get_video_stats ---
  server.registerTool(
    "get_video_stats",
    {
      title: "Get Video Stats",
      description:
        "Quick statistics lookup for one or more videos. Returns view count, likes, and comments.",
      inputSchema: {
        video_id: z
          .string()
          .describe("Comma-separated video ID(s) or YouTube URLs"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ video_id }) => {
      try {
        const ids = extractMultipleVideoIds(video_id);
        const data = await youtubeApiFetch<VideoListResponse>("videos", {
          id: ids.join(","),
          part: "statistics",
        });

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No videos found for ID(s): ${ids.join(", ")}`,
              },
            ],
          };
        }

        const lines: string[] = ["# Video Statistics", ""];
        for (const video of data.items) {
          lines.push(`**${video.id}**`);
          if (video.statistics) {
            lines.push(
              `- Views: ${Number(video.statistics.viewCount).toLocaleString()}`
            );
            lines.push(
              `- Likes: ${Number(video.statistics.likeCount).toLocaleString()}`
            );
            lines.push(
              `- Comments: ${Number(video.statistics.commentCount).toLocaleString()}`
            );
          }
          lines.push("");
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
