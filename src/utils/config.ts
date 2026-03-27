import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = ".nps-youtube-mcp";
const CONFIG_FILE = "config.json";

export interface AppConfig {
  apiKey: string;
}

/**
 * Returns the path to the user-level config directory: ~/.nps-youtube-mcp/
 */
export function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR);
}

/**
 * Returns the path to the config file: ~/.nps-youtube-mcp/config.json
 */
export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE);
}

/**
 * Resolve the YouTube API key using a two-step lookup:
 *   1. Environment variable YOUTUBE_API_KEY (set by MCP client or system)
 *   2. User-level config file ~/.nps-youtube-mcp/config.json
 *
 * Returns the key string or null if not found anywhere.
 */
export function resolveApiKey(): string | null {
  // 1. Environment variable (highest priority — set by MCP client config or system)
  const envKey = process.env.YOUTUBE_API_KEY;
  if (envKey) return envKey;

  // 2. User-level config file
  try {
    const raw = readFileSync(getConfigPath(), "utf-8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    if (typeof config.apiKey === "string" && config.apiKey) {
      return config.apiKey;
    }
  } catch {
    // File doesn't exist or is malformed — fall through
  }

  return null;
}

/**
 * Resolve the YouTube API key or throw a descriptive error.
 */
export function requireApiKey(): string {
  const key = resolveApiKey();
  if (key) return key;

  const configPath = getConfigPath();
  throw new Error(
    "YouTube API key not found. Provide it using one of these methods:\n\n" +
      "  1. Run setup:   npx nps-youtube-mcp setup\n" +
      "  2. Env variable: set YOUTUBE_API_KEY in your environment or MCP client config\n\n" +
      `Setup stores the key in: ${configPath}\n` +
      "Get a key from https://console.cloud.google.com/ with YouTube Data API v3 enabled."
  );
}
