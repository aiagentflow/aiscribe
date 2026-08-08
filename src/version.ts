// Version auto-read from package.json
import { readFileSync } from "fs";
import { join } from "path";

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export const VERSION = readVersion();
