import type {
  CaptionTrack,
  Chapter,
  LanguageInfo,
  TranscriptResult,
  TranscriptSegment,
} from "../types/youtube.js";
import {
  TranscriptDisabledError,
  TranscriptFetchError,
  TranscriptNotAvailableError,
  VideoNotFoundError,
} from "../types/youtube.js";

const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const INNERTUBE_CLIENT_VERSION = "20.10.38";
const ANDROID_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;
const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

interface InnerTubeResponse {
  videoDetails?: { shortDescription?: string; videoId?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        baseUrl: string;
        languageCode: string;
        kind?: string;
        name?: { simpleText?: string };
      }>;
    };
  };
  playabilityStatus?: {
    status: string;
    reason?: string;
  };
}

interface PlayerData {
  captions: CaptionTrack[];
  description: string;
  title: string;
  engagementChapters: Array<{ title: string; time: number }>;
}

// --- HTML Entity Decoding ---

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 10))
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/\n/g, " ");
}

// --- XML Parsing (supports both classic and srv3 formats) ---

function parseTimedTextXml(xml: string): TranscriptSegment[] {
  // Try srv3 format first: <p t="ms" d="ms"><s>word</s>...</p>
  const srv3Segments = parseSrv3Format(xml);
  if (srv3Segments.length > 0) return srv3Segments;

  // Fall back to classic format: <text start="s" dur="s">content</text>
  return parseClassicFormat(xml);
}

function parseSrv3Format(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;

  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    const inner = match[3];

    // Extract text from <s> tags, or fall back to stripping all tags
    let text = "";
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1];
    }
    if (!text) {
      text = inner.replace(/<[^>]+>/g, "");
    }
    text = decodeHtmlEntities(text).trim();

    if (text) {
      segments.push({
        text,
        start: startMs / 1000,
        duration: durMs / 1000,
      });
    }
  }

  return segments;
}

function parseClassicFormat(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const duration = match[2] ? parseFloat(match[2]) : 0;
    const text = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, ""));

    if (text.trim()) {
      segments.push({ text: text.trim(), start, duration });
    }
  }

  return segments;
}

// --- Chapter Parsing ---

function parseTimestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function parseChaptersFromDescription(description: string, videoDuration?: number): Chapter[] {
  const lines = description.split("\n");
  const chapterRegex = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  const raw: Array<{ time: number; title: string }> = [];

  for (const line of lines) {
    const match = line.trim().match(chapterRegex);
    if (match) {
      raw.push({
        time: parseTimestampToSeconds(match[1]),
        title: match[2].trim(),
      });
    }
  }

  if (raw.length < 2) return [];

  const chapters: Chapter[] = [];
  for (let i = 0; i < raw.length; i++) {
    chapters.push({
      title: raw[i].title,
      startTime: raw[i].time,
      endTime: i < raw.length - 1 ? raw[i + 1].time : (videoDuration ?? raw[i].time + 600),
    });
  }

  return chapters;
}

// --- Main Fetcher Class ---

export class TranscriptFetcher {
  private cache = new Map<string, PlayerData>();

  /**
   * Primary method: ANDROID InnerTube client.
   * More reliable than WEB client for caption access.
   */
  private async fetchViaInnerTube(videoId: string): Promise<PlayerData | undefined> {
    try {
      const response = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": ANDROID_USER_AGENT,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "ANDROID",
              clientVersion: INNERTUBE_CLIENT_VERSION,
            },
          },
          videoId,
        }),
      });

      if (!response.ok) return undefined;

      const data = (await response.json()) as InnerTubeResponse;

      if (
        data.playabilityStatus?.status === "ERROR" ||
        data.playabilityStatus?.status === "LOGIN_REQUIRED"
      ) {
        return undefined;
      }

      const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!tracks || tracks.length === 0) return undefined;

      return {
        captions: tracks.map((t) => ({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode,
          kind: t.kind,
          name: t.name?.simpleText ?? t.languageCode,
        })),
        description: data.videoDetails?.shortDescription ?? "",
        title: "",
        engagementChapters: [],
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Fallback method: scrape the watch page for embedded player data.
   */
  private async fetchViaWebPage(videoId: string): Promise<PlayerData> {
    let html: string;
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent": WEB_USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!response.ok) {
        if (response.status === 404) throw new VideoNotFoundError(videoId);
        throw new TranscriptFetchError(`Watch page returned ${response.status}`);
      }
      html = await response.text();
    } catch (error: unknown) {
      if (error instanceof VideoNotFoundError) throw error;
      if (error instanceof TranscriptFetchError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new TranscriptFetchError(`Network error fetching watch page: ${msg}`);
    }

    if (html.includes('class="g-recaptcha"')) {
      throw new TranscriptFetchError(
        "YouTube is rate-limiting requests from this IP. Try again later."
      );
    }

    if (html.includes('"playabilityStatus":{"status":"ERROR"')) {
      throw new VideoNotFoundError(videoId);
    }

    // Extract ytInitialPlayerResponse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = parseInlineJson(html, "ytInitialPlayerResponse") as any;
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    const captions: CaptionTrack[] = [];
    if (Array.isArray(tracks)) {
      for (const t of tracks) {
        captions.push({
          baseUrl: t.baseUrl,
          languageCode: t.languageCode,
          kind: t.kind,
          name: t.name?.simpleText ?? t.languageCode,
        });
      }
    }

    // Extract description
    let description = "";
    const descMatch = html.match(/"shortDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (descMatch) {
      try {
        description = JSON.parse(`"${descMatch[1]}"`);
      } catch {
        description = descMatch[1];
      }
    }

    // Extract engagement panel chapters
    const engagementChapters: Array<{ title: string; time: number }> = [];
    const macroMatch = html.match(/"macroMarkersListRenderer"\s*:\s*\{/);
    if (macroMatch) {
      // Simple extraction of chapter data from the page
      const chapterRegex = /"title"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"\s*\}.*?"timeDescription"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"\s*\}/g;
      const section = html.slice(macroMatch.index!, macroMatch.index! + 10000);
      let chMatch: RegExpExecArray | null;
      while ((chMatch = chapterRegex.exec(section)) !== null) {
        engagementChapters.push({
          title: chMatch[1],
          time: parseTimestampToSeconds(chMatch[2]),
        });
      }
    }

    return {
      captions,
      description,
      title: "",
      engagementChapters,
    };
  }

  private async getPlayerData(videoId: string): Promise<PlayerData> {
    const cached = this.cache.get(videoId);
    if (cached) return cached;

    // Try ANDROID InnerTube first (more reliable for caption URLs)
    const innerTubeData = await this.fetchViaInnerTube(videoId);
    if (innerTubeData && innerTubeData.captions.length > 0) {
      this.cache.set(videoId, innerTubeData);
      return innerTubeData;
    }

    // Fall back to web page scraping
    const webData = await this.fetchViaWebPage(videoId);
    this.cache.set(videoId, webData);
    return webData;
  }

  private selectTrack(tracks: CaptionTrack[], lang: string): CaptionTrack {
    // 1. Manual track matching language
    const manual = tracks.find(
      (t) => t.languageCode === lang && t.kind !== "asr"
    );
    if (manual) return manual;

    // 2. Auto-generated track matching language
    const auto = tracks.find(
      (t) => t.languageCode === lang && t.kind === "asr"
    );
    if (auto) return auto;

    // 3. Fallback: any manual track
    const anyManual = tracks.find((t) => t.kind !== "asr");
    if (anyManual) return anyManual;

    // 4. Fallback: any track
    return tracks[0];
  }

  async fetch(
    videoId: string,
    options?: { lang?: string }
  ): Promise<TranscriptResult> {
    const lang = options?.lang ?? "en";
    const data = await this.getPlayerData(videoId);

    if (data.captions.length === 0) {
      throw new TranscriptNotAvailableError(videoId);
    }

    const track = this.selectTrack(data.captions, lang);

    let xmlResponse: Response;
    try {
      xmlResponse = await fetch(track.baseUrl, {
        headers: { "User-Agent": ANDROID_USER_AGENT },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new TranscriptFetchError(`Failed to fetch timedtext: ${msg}`);
    }

    if (!xmlResponse.ok) {
      throw new TranscriptFetchError(
        `Timedtext request returned ${xmlResponse.status}`
      );
    }

    const xml = await xmlResponse.text();

    if (!xml || xml.trim().length === 0) {
      throw new TranscriptDisabledError(videoId);
    }

    const segments = parseTimedTextXml(xml);

    if (segments.length === 0) {
      throw new TranscriptDisabledError(videoId);
    }

    return {
      segments,
      languageCode: track.languageCode,
      isAutoGenerated: track.kind === "asr",
    };
  }

  async listAvailableLanguages(videoId: string): Promise<LanguageInfo[]> {
    const data = await this.getPlayerData(videoId);

    return data.captions.map((t) => ({
      code: t.languageCode,
      name: t.name,
      isAutoGenerated: t.kind === "asr",
    }));
  }

  async getChapters(videoId: string): Promise<Chapter[]> {
    const data = await this.getPlayerData(videoId);

    // Try description-based chapters first
    const descChapters = parseChaptersFromDescription(data.description);
    if (descChapters.length > 0) return descChapters;

    // Try engagement panel chapters
    if (data.engagementChapters.length >= 2) {
      const raw = data.engagementChapters;
      const chapters: Chapter[] = [];
      for (let i = 0; i < raw.length; i++) {
        chapters.push({
          title: raw[i].title,
          startTime: raw[i].time,
          endTime: i < raw.length - 1 ? raw[i + 1].time : raw[i].time + 600,
        });
      }
      return chapters;
    }

    return [];
  }
}

// --- Helpers ---

function parseInlineJson(html: string, globalName: string): Record<string, unknown> | null {
  const startToken = `var ${globalName} = `;
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) return null;

  const jsonStart = startIndex + startToken.length;
  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
