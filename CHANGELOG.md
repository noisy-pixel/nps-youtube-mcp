# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
- Post-MVP tool stubs: `get_channel_details`, `list_channel_playlists`, `get_channel_stats`, `list_playlist_items`, `get_playlist_details`, `get_playlist_transcripts`

### Technical Notes
- Uses ANDROID InnerTube client (`v20.10.38`) as primary caption source — WEB client returns UNPLAYABLE for many videos as of 2026-03-26
- Web page scraping retained as fallback method
- See [TRANSCRIPT-INTERNALS.md](TRANSCRIPT-INTERNALS.md) for detailed technical documentation
