// JSON output helper - used by all commands when --json flag is passed

export interface JSONOutput {
  ok: boolean;
  data?: unknown;
  error?: string;
  command: string;
  version: string;
}

export function jsonSuccess(command: string, data: unknown): void {
  const out: JSONOutput = {
    ok: true,
    data,
    command,
    version: require("./version").VERSION,
  };
  console.log(JSON.stringify(out, null, 2));
}

export function jsonError(command: string, error: string): void {
  const out: JSONOutput = {
    ok: false,
    error,
    command,
    version: require("./version").VERSION,
  };
  console.error(JSON.stringify(out, null, 2));
}
