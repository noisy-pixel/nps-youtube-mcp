# nps-youtube-mcp

> A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for YouTube — video metadata, search, channel listings, and transcript retrieval.

Built by **Noisy Pixel Studios**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- **Video metadata & statistics** via YouTube Data API v3
- **Video search** with filters (date, channel, type, sort order)
- **Channel video listing** with `@handle` and URL support
- **Transcript retrieval** via YouTube's InnerTube API (no API key required)
- **Transcript search** with contextual results and timestamps
- **Ad/sponsor filtering** via chapter-based heuristics
- Zero third-party HTTP dependencies — uses native `fetch` (Node 18+)

## Prerequisites

- **Node.js 18+**
- **YouTube Data API key** — required for video/search/channel tools (not needed for transcript tools)

### Getting a YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **API key**

## Installation

### From source (clone + global install)

```bash
git clone https://github.com/noisy-pixel/nps-youtube-mcp.git
cd nps-youtube-mcp
npm install
npm run build
npm install -g .
```

After this, `nps-youtube-mcp` is available as a command globally.

### Local development

```bash
git clone https://github.com/noisy-pixel/nps-youtube-mcp.git
cd nps-youtube-mcp
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | Yes (for API tools) | Google API key with YouTube Data API v3 enabled |

Transcript tools (`get_transcript`, `search_transcript`) do **not** require an API key.

### Claude Code

Add to your project's `.mcp.json` or VS Code `.vscode/mcp.json`:

```json
{
  "servers": {
    "youtube": {
      "command": "nps-youtube-mcp",
      "env": {
        "YOUTUBE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

If installed locally (not globally), use the full path instead:

```json
{
  "servers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/nps-youtube-mcp/dist/index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "nps-youtube-mcp",
      "env": {
        "YOUTUBE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### Implemented (MVP)

| Tool | Description | Requires API Key |
|---|---|---|
| `get_video_details` | Video metadata, stats, duration, tags | Yes |
| `search_videos` | Search YouTube with filters | Yes |
| `get_video_stats` | Quick view/like/comment counts | Yes |
| `list_channel_videos` | Recent uploads from a channel | Yes |
| `get_transcript` | Full video transcript with optional timestamps | No |
| `search_transcript` | Search within a transcript | No |

### Tool Parameters

#### `get_video_details`
- `video_id` (string, required) — comma-separated video ID(s) or URLs
- `parts` (string[], optional) — resource parts (default: snippet, contentDetails, statistics)

#### `search_videos`
- `query` (string, required) — search text
- `max_results` (number, optional) — 1-50, default 5
- `order` (string, optional) — relevance, date, viewCount, rating
- `channel_id` (string, optional) — restrict to a channel
- `published_after` / `published_before` (string, optional) — ISO 8601 date filters
- `type` (string, optional) — video, channel, or playlist

#### `get_video_stats`
- `video_id` (string, required) — comma-separated video ID(s) or URLs

#### `list_channel_videos`
- `channel_id` (string, required) — channel ID, URL, or @handle
- `max_results` (number, optional) — 1-50, default 10
- `order` (string, optional) — date, relevance, viewCount, rating

#### `get_transcript`
- `video_id` (string, required) — video ID or URL
- `include_timestamps` (boolean, optional) — prefix segments with `[M:SS]`
- `lang` (string, optional) — language code, default "en"
- `remove_ads` (boolean, optional) — filter ad segments via chapter markers

#### `search_transcript`
- `video_id` (string, required) — video ID or URL
- `query` (string, required) — text to search for
- `context_lines` (number, optional) — surrounding segments (0-10, default 2)
- `lang` (string, optional) — language code, default "en"

### Planned (Post-MVP)

These tools are defined but not yet implemented:

- `get_channel_details` — channel metadata
- `list_channel_playlists` — channel playlists
- `get_channel_stats` — subscriber/video/view counts
- `list_playlist_items` — playlist videos
- `get_playlist_details` — playlist metadata
- `get_playlist_transcripts` — bulk playlist transcripts

## Supported URL Formats

The server accepts all common YouTube URL formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`
- `https://youtube.com/shorts/VIDEO_ID`
- Bare 11-character video ID

Channel tools accept:
- Channel IDs (`UC...`)
- Channel URLs (`https://www.youtube.com/channel/UC...`)
- Handle format (`@mkbhd`)
- Handle URLs (`https://www.youtube.com/@mkbhd`)

## Known Limitations

- **API Quota** — YouTube Data API has a default quota of 10,000 units/day. Search costs 100 units; most other operations cost 1 unit.
- **Transcript availability** — not all videos have captions. Auto-generated captions may have lower accuracy.
- **InnerTube API** — transcript fetching uses YouTube's undocumented InnerTube API, which may change without notice. See [TRANSCRIPT-INTERNALS.md](TRANSCRIPT-INTERNALS.md) for technical details.
- **No OAuth** — uses API key authentication only. Features requiring OAuth (managing captions, private content) are not supported.
- **Ad filtering** — the `remove_ads` feature is heuristic and chapter-dependent. Only works for videos with chapter markers. May produce false positives or miss unlabeled ads.

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/noisy-pixel/nps-youtube-mcp).

## License

[MIT](LICENSE) — Noisy Pixel Studios
