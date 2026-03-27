import { requireApiKey } from "./config.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export async function youtubeApiFetch<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", requireApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    // Retry once on network error
    try {
      response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new Error(`Network error calling YouTube API: ${message}`);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 403) {
      if (body.includes("quotaExceeded")) {
        throw new Error(
          "YouTube API quota exceeded. The default quota is 10,000 units/day. " +
            "Try again tomorrow or request a quota increase in the Google Cloud Console."
        );
      }
      throw new Error(
        `YouTube API access forbidden (403). Check that your API key is valid and YouTube Data API v3 is enabled.`
      );
    }
    if (response.status === 404) {
      throw new Error("YouTube API resource not found (404).");
    }
    throw new Error(
      `YouTube API error ${response.status}: ${body.slice(0, 500)}`
    );
  }

  return (await response.json()) as T;
}
