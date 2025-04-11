import path from "node:path";
import fs from "node:fs";

const CONFIG_FILE_NAME = "minipack.config.js";

export function loadConfig() {
  const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${CONFIG_FILE_NAME}`);
  }

  const config = require(configPath);

  if (typeof config !== "object" || config === null) {
    throw new Error(`Invalid configuration in ${CONFIG_FILE_NAME}`);
  }

  return config;
}
