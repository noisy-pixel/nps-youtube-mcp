import type { SearchListResponse } from "../types/youtube.js";
import { youtubeApiFetch } from "./youtube-api.js";

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const URL_PATTERNS: Array<{ regex: RegExp; idGroup: number }> = [
  { regex: /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/, idGroup: 1 },
  { regex: /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, idGroup: 1 },
  { regex: /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, idGroup: 1 },
  { regex: /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/, idGroup: 1 },
  { regex: /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/, idGroup: 1 },
];

export function extractVideoId(input: string): string {
  const trimmed = input.trim();

  if (VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  for (const { regex, idGroup } of URL_PATTERNS) {
    const match = trimmed.match(regex);
    if (match?.[idGroup]) {
      return match[idGroup];
    }
  }

  throw new Error(
    `Could not extract a valid video ID from: ${trimmed}. Expected a YouTube URL or 11-character video ID.`
  );
}

export function extractMultipleVideoIds(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(extractVideoId);
}

const CHANNEL_ID_REGEX = /^UC[a-zA-Z0-9_-]{22}$/;
const CHANNEL_URL_REGEX =
  /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/;
const HANDLE_REGEX = /^@[\w.-]+$/;
const HANDLE_URL_REGEX = /youtube\.com\/@([\w.-]+)/;
const CUSTOM_URL_REGEX = /youtube\.com\/c\/([\w.-]+)/;

export async function resolveChannelId(input: string): Promise<string> {
  const trimmed = input.trim();

  if (CHANNEL_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  const channelUrlMatch = trimmed.match(CHANNEL_URL_REGEX);
  if (channelUrlMatch?.[1]) {
    return channelUrlMatch[1];
  }

  let searchQuery: string | undefined;

  const handleUrlMatch = trimmed.match(HANDLE_URL_REGEX);
  if (handleUrlMatch?.[1]) {
    searchQuery = `@${handleUrlMatch[1]}`;
  } else if (HANDLE_REGEX.test(trimmed)) {
    searchQuery = trimmed;
  } else {
    const customUrlMatch = trimmed.match(CUSTOM_URL_REGEX);
    if (customUrlMatch?.[1]) {
      searchQuery = customUrlMatch[1];
    }
  }

  if (searchQuery) {
    const data = await youtubeApiFetch<SearchListResponse>("search", {
      q: searchQuery,
      type: "channel",
      maxResults: "1",
    });

    const channelId = data.items?.[0]?.id?.channelId;
    if (channelId) {
      return channelId;
    }

    throw new Error(
      `Could not resolve channel for "${searchQuery}". No matching channel found.`
    );
  }

  throw new Error(
    `Could not resolve channel ID from: ${trimmed}. Expected a channel ID (UC...), channel URL, or @handle.`
  );
}
