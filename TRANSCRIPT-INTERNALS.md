# Transcript Fetcher — Technical Notes

Last verified: 2026-03-26

## How It Works

The transcript fetcher retrieves captions from public YouTube videos without an API key by using YouTube's internal InnerTube API and timedtext endpoints.

### Two-Strategy Approach

The fetcher tries two methods in order:

1. **ANDROID InnerTube client** (primary) — POST to `/youtubei/v1/player`
2. **Web page scraping** (fallback) — GET the `/watch` page and extract `ytInitialPlayerResponse`

If the ANDROID client returns caption tracks, those are used. Otherwise, it falls back to scraping the watch page HTML.

---

## Why ANDROID Client, Not WEB

**Discovered 2026-03-26**: The `WEB` InnerTube client no longer reliably returns playable responses for many videos. Testing showed:

| Client | Version | Status | Captions |
|--------|---------|--------|----------|
| `WEB` | `2.20240101.00.00` | `UNPLAYABLE` | No |
| `WEB` | `2.20250320.00.00` | `UNPLAYABLE` | No |
| `MWEB` | `2.20250320.00.00` | `UNPLAYABLE` | No |
| `WEB_EMBEDDED_PLAYER` | `1.20250320.00.00` | `ERROR` | No |
| `WEB_CREATOR` | `1.20250320.00.00` | `LOGIN_REQUIRED` | No |
| **`ANDROID`** | **`20.10.38`** | **`OK`** | **Yes** |

The ANDROID client with version `20.10.38` and User-Agent `com.google.android.youtube/20.10.38 (Linux; U; Android 14)` is the only client that consistently returns `OK` status with caption tracks.

This matches what the `youtube-transcript` npm package (v1.3.0) uses as of the same date.

## The `ip=0.0.0.0` Problem

Even when caption tracks are found via web page scraping, the timedtext base URLs often contain `ip=0.0.0.0`. This causes the timedtext endpoint to return **empty responses** (200 OK but zero bytes).

- The `ip` parameter is part of the signed URL — modifying it invalidates the signature (returns 404).
- This happens because YouTube's server-side rendering doesn't associate a real client IP with the embedded player response.
- The ANDROID InnerTube client also returns `ip=0.0.0.0` in its URLs, but the timedtext endpoint **still serves content** when fetched with the Android User-Agent. This is the critical difference.

**Key takeaway**: Always fetch timedtext URLs using the ANDROID User-Agent (`com.google.android.youtube/...`), regardless of which method discovered the caption tracks.

## Timedtext XML Formats

YouTube serves captions in two XML formats depending on the source:

### Classic Format (manual captions, older videos)
```xml
<text start="0.21" dur="2.34">Hey everyone</text>
<text start="2.55" dur="3.12">welcome to the video</text>
```
- `start` and `dur` are in **seconds** (float)

### srv3 Format (auto-generated captions, newer videos)
```xml
<p t="80" d="3920" w="1">
  <s ac="0">So,</s>
  <s t="240" ac="0"> you</s>
  <s t="480" ac="0"> come</s>
</p>
```
- `t` and `d` are in **milliseconds** (integer)
- Individual words are in `<s>` tags within `<p>` segments
- The fetcher concatenates all `<s>` text within each `<p>` into a single segment

The fetcher tries srv3 parsing first, then falls back to classic format.

## HTML Entity Decoding

Caption text frequently contains HTML entities that must be decoded:
- `&amp;` `&lt;` `&gt;` `&quot;` `&#39;` `&apos;`
- Numeric: `&#123;` (decimal), `&#x7B;` (hex)
- `\n` within text is replaced with spaces

## Things That May Break

These are undocumented internal APIs. If transcripts stop working, check:

1. **ANDROID client version** — YouTube may start rejecting old versions. Update `INNERTUBE_CLIENT_VERSION` and the matching User-Agent. Check what version the `youtube-transcript` npm package is using as a reference.
2. **InnerTube endpoint URL** — Currently `https://www.youtube.com/youtubei/v1/player`. Could change.
3. **Timedtext URL structure** — The `baseUrl` format in caption tracks could change.
4. **XML format** — New caption formats may be introduced beyond classic and srv3.
5. **Rate limiting** — YouTube may start blocking IPs that make too many InnerTube requests. The fetcher does not currently implement rate limiting or retries for this.
6. **Consent/cookie requirements** — EU consent flows or bot detection could affect web page scraping fallback.

## References

- [youtube-transcript npm](https://github.com/Kakulukian/youtube-transcript) — Reference implementation using the same ANDROID client approach
- [mcp-server-youtube-transcript](https://github.com/kimtaeyoon83/mcp-server-youtube-transcript) — Another MCP server implementation
