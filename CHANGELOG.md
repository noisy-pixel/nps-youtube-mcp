# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.1-beta] - 2026-03-27

### Added
- **Setup command**: `nps-youtube-mcp setup` — one-time CLI command to configure the YouTube API key, stored in `~/.nps-youtube-mcp/config.json`
- **Config file fallback**: Server now resolves the API key from environment variable first, then user-level config file, with a descriptive error if neither is found
- **`.env` detection**: Setup command automatically reads `YOUTUBE_API_KEY` from a `.env` file in the current directory if present
- **`.env.example`**: Template file for API key configuration

### Changed
- API key is no longer required in MCP client configs — setup handles it once per machine
- Simplified README installation and configuration instructions
- MCP client config examples now use `nps-youtube-mcp` as the server name (instead of generic `youtube`)

## [0.5.0-beta] - 2026-03-26

### Added
- **Channel tools**: `get_channel_details` — full channel metadata, statistics, branding, and uploads playlist
- **Channel tools**: `get_channel_stats` — lightweight subscriber, view, and video counts
- **Channel tools**: `list_channel_playlists` — list all public playlists for a channel
- **Playlist tools**: `list_playlist_items` — list all videos in a playlist with metadata
- **Playlist tools**: `get_playlist_details` — playlist title, description, channel, and item count
- **Playlist tools**: `get_playlist_transcripts` — bulk-fetch transcripts for all videos in a playlist (up to 25)

### Changed
- All 12 tools are now fully implemented (no more stubs)
- Added YouTube API types: `ChannelSnippet`, `ChannelStatistics`, `ChannelBrandingSettings`, `PlaylistSnippet`, `PlaylistResource`, `PlaylistListResponse`

## [0.4.3-beta] - 2026-03-26

### Added
- Initial public release
- **Video tools**: `get_video_details`, `search_videos`, `get_video_stats`
- **Channel tools**: `list_channel_videos` with @handle and URL resolution
- **Transcript tools**: `get_transcript` with timestamp and ad-filtering support, `search_transcript` with contextual results
- Custom transcript fetcher using YouTube InnerTube API (ANDROID client) — no API key or third-party dependencies required
- Support for both classic (`<text>`) and srv3 (`<p>/<s>`) timedtext XML formats
- Chapter-based ad/sponsor filtering heuristic via `remove_ads` parameter
- All common YouTube URL formats supported (watch, youtu.be, embed, shorts, bare ID)
- Channel resolution from @handles, URLs, and direct IDs

### Notes
- Uses ANDROID InnerTube client (`v20.10.38`) as primary caption source — WEB client returns UNPLAYABLE for many videos as of 2026-03-26
- Web page scraping retained as fallback method
- See [TRANSCRIPT-INTERNALS.md](TRANSCRIPT-INTERNALS.md) for detailed technical documentation
