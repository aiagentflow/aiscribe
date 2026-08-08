// Terminal styling using ANSI escape codes (zero dependencies)

const CSI = "\x1b[";

export const style = {
  reset: CSI + "0m",
  bold: CSI + "1m",
  dim: CSI + "2m",
  italic: CSI + "3m",
  underline: CSI + "4m",

  // Foreground
  black: CSI + "30m",
  red: CSI + "31m",
  green: CSI + "32m",
  yellow: CSI + "33m",
  blue: CSI + "34m",
  magenta: CSI + "35m",
  cyan: CSI + "36m",
  white: CSI + "37m",
  gray: CSI + "90m",

  // Background
  bgRed: CSI + "41m",
  bgGreen: CSI + "42m",
  bgYellow: CSI + "43m",
  bgBlue: CSI + "44m",
  bgCyan: CSI + "46m",
};

export function color(text: string, ...codes: string[]): string {
  const prefix = codes.join("");
  if (!prefix) return text;
  return prefix + text + style.reset;
}

// ── Semantic helpers ──

export function dim(text: string): string {
  return color(text, style.dim);
}

export function bold(text: string): string {
  return color(text, style.bold);
}

export function green(text: string): string {
  return color(text, style.green);
}

export function red(text: string): string {
  return color(text, style.red);
}

export function yellow(text: string): string {
  return color(text, style.yellow);
}

export function blue(text: string): string {
  return color(text, style.blue);
}

export function cyan(text: string): string {
  return color(text, style.cyan);
}

export function gray(text: string): string {
  return color(text, style.gray);
}

// ── Risk colors ──

export function riskColor(risk: string): string {
  const r = risk.toLowerCase();
  if (r.includes("high")) return red("HIGH");
  if (r.includes("medium") || r.includes("mid")) return yellow("MEDIUM");
  return green("LOW");
}

// ── Box drawing ──

export function boxTop(label: string): string {
  return dim("┌─ ") + bold(label);
}

export function boxLine(label: string, value: string): string {
  return dim("│  ") + dim(label + ": ") + value;
}

export function boxMid(label: string): string {
  return dim("├─ ") + bold(label);
}

export function boxBot(): string {
  return dim("└─");
}

// ── Spinner frames ──

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(message: string) {
  let frame = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start(): void {
      process.stdout.write("\n");
      interval = setInterval(() => {
        process.stdout.write(
          CSI + "1A" + CSI + "2K" + // move up, clear line
          cyan(SPINNER[frame % SPINNER.length]) + " " + message + "\n"
        );
        frame++;
      }, 80);
    },
    stop(success: string): void {
      if (interval) clearInterval(interval);
      process.stdout.write(CSI + "1A" + CSI + "2K");
      console.log(green("✓") + " " + success);
    },
    fail(error: string): void {
      if (interval) clearInterval(interval);
      process.stdout.write(CSI + "1A" + CSI + "2K");
      console.log(red("✗") + " " + error);
    },
  };
}

// ── Stats bar ──

export function statsBar(stats: Record<string, string | number>): string {
  const items = Object.entries(stats).map(
    ([label, value]) => dim(label + ": ") + bold(String(value))
  );
  return items.join(dim("  │  "));
}
