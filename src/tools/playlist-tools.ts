import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  PlaylistListResponse,
  PlaylistItemListResponse,
} from "../types/youtube.js";
import { youtubeApiFetch } from "../utils/youtube-api.js";
import { TranscriptFetcher } from "../utils/transcript-fetcher.js";
import { formatTimestamp } from "../utils/formatters.js";

const fetcher = new TranscriptFetcher();

export function registerPlaylistTools(server: McpServer): void {
  // --- list_playlist_items ---
  server.registerTool(
    "list_playlist_items",
    {
      title: "List Playlist Items",
      description:
        "Get all videos in a YouTube playlist with titles, video IDs, and publication dates.",
      inputSchema: {
        playlist_id: z.string().describe("YouTube playlist ID"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Number of items to return (1-50)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ playlist_id, max_results }) => {
      try {
        const data = await youtubeApiFetch<PlaylistItemListResponse>(
          "playlistItems",
          {
            playlistId: playlist_id,
            part: "snippet,contentDetails",
            maxResults: String(max_results),
          }
        );

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No items found in playlist: ${playlist_id}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Playlist Items`,
          "",
          `Showing ${data.items.length} of ${data.pageInfo.totalResults} videos`,
          "",
        ];

        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const videoId =
            item.snippet.resourceId?.videoId ??
            item.contentDetails?.videoId ??
            "unknown";
          lines.push(`${i + 1}. **${item.snippet.title}**`);
          lines.push(`   - Video ID: ${videoId}`);
          lines.push(
            `   - Published: ${item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt}`
          );
          if (item.snippet.description) {
            const desc =
              item.snippet.description.length > 150
                ? item.snippet.description.slice(0, 150) + "..."
                : item.snippet.description;
            lines.push(`   - Description: ${desc}`);
          }
          lines.push("");
        }

        if (data.nextPageToken) {
          lines.push(
            `*More items available (next page token: ${data.nextPageToken})*`
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

  // --- get_playlist_details ---
  server.registerTool(
    "get_playlist_details",
    {
      title: "Get Playlist Details",
      description:
        "Get playlist title, description, channel, and item count.",
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
    async ({ playlist_id }) => {
      try {
        const data = await youtubeApiFetch<PlaylistListResponse>("playlists", {
          id: playlist_id,
          part: "snippet,contentDetails",
        });

        const pl = data.items?.[0];
        if (!pl) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Playlist not found: ${playlist_id}`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`## ${pl.snippet?.title ?? pl.id}`);
        lines.push("");
        lines.push(`- **Playlist ID**: ${pl.id}`);
        if (pl.snippet?.channelTitle) {
          lines.push(`- **Channel**: ${pl.snippet.channelTitle}`);
        }
        if (pl.contentDetails?.itemCount !== undefined) {
          lines.push(`- **Videos**: ${pl.contentDetails.itemCount}`);
        }
        if (pl.snippet?.publishedAt) {
          lines.push(`- **Created**: ${pl.snippet.publishedAt}`);
        }
        if (pl.snippet?.description) {
          lines.push(`- **Description**: ${pl.snippet.description}`);
        }
        if (pl.snippet?.thumbnails?.high) {
          lines.push(`- **Thumbnail**: ${pl.snippet.thumbnails.high.url}`);
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

  // --- get_playlist_transcripts ---
  server.registerTool(
    "get_playlist_transcripts",
    {
      title: "Get Playlist Transcripts",
      description:
        "Bulk-fetch transcripts for all videos in a playlist. " +
        "Returns each video's transcript sequentially. Useful for research across a series of videos. " +
        "Does not require an API key for the transcript portion, but does require one to list playlist items.",
      inputSchema: {
        playlist_id: z.string().describe("YouTube playlist ID"),
        lang: z
          .string()
          .default("en")
          .describe("Preferred transcript language code"),
        max_videos: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(10)
          .describe("Maximum number of videos to fetch transcripts for (1-25)"),
        include_timestamps: z
          .boolean()
          .default(false)
          .describe("Prefix each segment with [M:SS] timestamps"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ playlist_id, lang, max_videos, include_timestamps }) => {
      try {
        // Fetch playlist items
        const data = await youtubeApiFetch<PlaylistItemListResponse>(
          "playlistItems",
          {
            playlistId: playlist_id,
            part: "snippet,contentDetails",
            maxResults: String(max_videos),
          }
        );

        if (!data.items || data.items.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No items found in playlist: ${playlist_id}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `# Playlist Transcripts`,
          "",
          `Fetching transcripts for ${data.items.length} video(s)...`,
          "",
        ];

        let successCount = 0;
        let failCount = 0;

        for (const item of data.items) {
          const videoId =
            item.snippet.resourceId?.videoId ??
            item.contentDetails?.videoId;
          const title = item.snippet.title;

          lines.push(`---`);
          lines.push(`## ${title}`);
          lines.push(`**Video ID**: ${videoId}`);
          lines.push("");

          if (!videoId) {
            lines.push("*Could not determine video ID*");
            lines.push("");
            failCount++;
            continue;
          }

          try {
            const result = await fetcher.fetch(videoId, { lang });

            const meta = `Language: ${result.languageCode}${result.isAutoGenerated ? " (auto-generated)" : ""} | Segments: ${result.segments.length}`;
            lines.push(`*${meta}*`);
            lines.push("");

            if (include_timestamps) {
              for (const seg of result.segments) {
                lines.push(`[${formatTimestamp(seg.start)}] ${seg.text}`);
              }
            } else {
              lines.push(result.segments.map((s) => s.text).join(" "));
            }

            lines.push("");
            successCount++;
          } catch (error: unknown) {
            const msg =
              error instanceof Error ? error.message : String(error);
            lines.push(`*Transcript unavailable: ${msg}*`);
            lines.push("");
            failCount++;
          }
        }

        lines.push("---");
        lines.push("");
        lines.push(
          `**Summary**: ${successCount} transcript(s) fetched, ${failCount} failed/unavailable`
        );

        if (data.pageInfo.totalResults > data.items.length) {
          lines.push(
            `*${data.pageInfo.totalResults - data.items.length} more video(s) in playlist not fetched*`
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
