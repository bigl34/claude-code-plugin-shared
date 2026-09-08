
import type { RawArgs, GlobalFlags } from "./types.js";

export function parseArgs(argv: string[]): RawArgs {
  const args: RawArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "-h") {
      args.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      continue;
    }

    if (arg.includes("=")) {
      const [key, ...valueParts] = arg.slice(2).split("=");
      const value = valueParts.join("=");
      args[kebabToCamel(key)] = value;
      continue;
    }

    const key = arg.slice(2);

    if (key.startsWith("no-")) {
      const positiveKey = key.slice(3);
      args[kebabToCamel(positiveKey)] = false;
      continue;
    }

    const nextArg = argv[i + 1];
    if (nextArg && nextArg !== "-h" && !nextArg.startsWith("--")) {
      args[kebabToCamel(key)] = nextArg;
      i++;
    } else {
      args[kebabToCamel(key)] = true;
    }
  }

  return args;
}

export function extractCommand(argv: string[]): string | undefined {
  return argv.find((arg) => arg !== "-h" && !arg.startsWith("--"));
}

export function extractGlobalFlags(args: RawArgs): GlobalFlags {
  return {
    noCache:
      args.noCache === true ||
      args.noCache === "true" ||
      args.cache === false ||
      args.cache === "false",
    help: args.help === true || args.help === "true",
    verbose: args.verbose === true || args.verbose === "true",
    dryRun: args.dryRun === true || args.dryRun === "true",
    confirm: args.confirm === true || args.confirm === "true",
  };
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
