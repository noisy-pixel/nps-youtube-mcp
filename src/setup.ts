import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { getConfigDir, getConfigPath, resolveApiKey } from "./utils/config.js";

/**
 * Interactive setup command.
 *
 * Lookup order for the API key:
 *   1. --key <value> CLI argument
 *   2. .env file in the current working directory
 *   3. Interactive prompt (stdin)
 */
export async function runSetup(args: string[]): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  console.log("\nnps-youtube-mcp setup");
  console.log("====================\n");

  // Check if already configured
  const existing = resolveApiKey();
  if (existing) {
    const source = process.env.YOUTUBE_API_KEY
      ? "environment variable"
      : configPath;
    console.log(`A YouTube API key is already configured via: ${source}`);
    console.log(
      "To reconfigure, continue below. Press Ctrl+C to cancel.\n"
    );
  }

  let apiKey: string | undefined;

  // 1. CLI argument: --key <value>
  const keyFlagIndex = args.indexOf("--key");
  if (keyFlagIndex !== -1 && args[keyFlagIndex + 1]) {
    apiKey = args[keyFlagIndex + 1];
    console.log("Using API key from --key argument.");
  }

  // 2. .env file in cwd
  if (!apiKey) {
    const envPath = resolve(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf-8");
      const match = envContent.match(
        /^YOUTUBE_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m
      );
      if (match?.[1]) {
        apiKey = match[1].trim();
        console.log(`Found API key in ${envPath}`);
      }
    }
  }

  // 3. Interactive prompt
  if (!apiKey) {
    apiKey = await promptForKey();
  }

  if (!apiKey) {
    console.error("\nNo API key provided. Setup cancelled.");
    process.exit(1);
  }

  // Validate key format (basic sanity check — Google API keys are typically 39 chars)
  if (apiKey.length < 10) {
    console.error("\nAPI key seems too short. Please check and try again.");
    process.exit(1);
  }

  // Write config
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const config = { apiKey };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(`\nAPI key saved to: ${configPath}`);
  console.log("\nSetup complete! The MCP server will now use this key.");
  console.log(
    "You can override it anytime by setting the YOUTUBE_API_KEY environment variable.\n"
  );
}

function promptForKey(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(
      "Enter your YouTube Data API v3 key"
    );
    console.log(
      "(Get one at https://console.cloud.google.com/ with YouTube Data API v3 enabled)\n"
    );

    rl.question("API key: ", (answer) => {
      rl.close();
      resolve(answer.trim() || undefined);
    });
  });
}
