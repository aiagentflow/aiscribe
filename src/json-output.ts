// JSON output helper with syntax coloring (like jq)
// All commands use this when --json flag is passed

import { green, blue, cyan, yellow, gray, style } from "./terminal";

export interface JSONOutput {
  ok: boolean;
  data?: unknown;
  error?: string;
  command: string;
  version: string;
}

function colorizeJSON(json: string): string {
  let out = "";
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    if (ch === '"') {
      // Find the full string
      const start = i;
      i++;
      while (i < json.length && !(json[i] === '"' && json[i - 1] !== "\\")) i++;
      const full = json.slice(start, i + 1);
      i++;

      // Is this a key? Check if next non-space char is ':'
      let j = i;
      while (j < json.length && (json[j] === " " || json[j] === "\n")) j++;
      if (json[j] === ":") {
        out += cyan(full);
      } else {
        out += green(full);
      }
      continue;
    }

    // Numbers
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const start = i;
      while (i < json.length && "0123456789.eE+-".includes(json[i])) i++;
      out += yellow(json.slice(start, i));
      continue;
    }

    // Booleans
    if (json.slice(i, i + 4) === "true") { out += style.magenta + "true" + style.reset; i += 4; continue; }
    if (json.slice(i, i + 5) === "false") { out += style.magenta + "false" + style.reset; i += 5; continue; }

    // Null
    if (json.slice(i, i + 4) === "null") { out += gray("null"); i += 4; continue; }

    out += ch;
    i++;
  }

  return out;
}

export function jsonSuccess(command: string, data: unknown): void {
  const out: JSONOutput = {
    ok: true,
    data,
    command,
    version: require("./version").VERSION,
  };
  console.log(colorizeJSON(JSON.stringify(out, null, 2)));
}

export function jsonError(command: string, error: string): void {
  const out: JSONOutput = {
    ok: false,
    error,
    command,
    version: require("./version").VERSION,
  };
  console.error(colorizeJSON(JSON.stringify(out, null, 2)));
}
