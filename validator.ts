/**
 * @local/cli-utils Validator
 *
 * Zod-based validation and CLI runner utilities.
 */

import { z, ZodError } from "zod";
import {
  CommandDef,
  CommandHandler,
  CommandMap,
  GlobalFlags,
  RunCliOptions,
  SchemaField,
} from "./types.js";
import {
  parseArgs,
  extractCommand,
  extractGlobalFlags,
  camelToKebab,
} from "./parser.js";

/**
 * Create a command definition with schema and handler.
 *
 * @param schema - Zod schema for command arguments
 * @param handler - Async function to execute the command
 * @param description - Optional command description for help text
 * @returns Command definition object
 *
 * @example
 * const getOrder = createCommand(
 *   z.object({ orderId: z.string() }),
 *   async (args, client) => client.getOrder(args.orderId),
 *   "Retrieve an order by ID"
 * );
 */
export function createCommand<TClient>(
  schema: z.ZodType,
  handler: CommandHandler<unknown, TClient>,
  description?: string
): CommandDef<TClient> {
  return { schema, handler, description };
}

/**
 * Pre-built cache commands that work with any client implementing cache methods.
 *
 * @returns Command map for cache-stats, cache-clear, cache-invalidate
 */
export function cacheCommands<
  TClient extends {
    getCacheStats: () => unknown;
    clearCache: () => number;
    invalidateCacheKey: (key: string) => boolean;
  }
>(): CommandMap<TClient> {
  return {
    "cache-stats": createCommand(
      z.object({}),
      async (_args, client) => client.getCacheStats(),
      "Show cache statistics"
    ),
    "cache-clear": createCommand(
      z.object({}),
      async (_args, client) => ({ cleared: client.clearCache() }),
      "Clear all cached data"
    ),
    "cache-invalidate": createCommand(
      z.object({
        key: z.string().min(1).describe("Cache key to invalidate"),
      }),
      async (args, client) => ({ invalidated: client.invalidateCacheKey((args as { key: string }).key) }),
      "Invalidate a specific cache key"
    ),
  };
}

/**
 * Format a Zod error into a user-friendly message.
 *
 * @param error - ZodError from validation
 * @returns Formatted error message
 */
export function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `--${camelToKebab(issue.path.join("."))}` : "input";
    switch (issue.code) {
      case "invalid_type":
        if (issue.received === "undefined") {
          return `Missing required argument: ${path}`;
        }
        return `${path}: Expected ${issue.expected}, got ${issue.received}`;
      case "too_small":
        return `${path}: Value too small (minimum: ${(issue as z.ZodTooSmallIssue).minimum})`;
      case "too_big":
        return `${path}: Value too large (maximum: ${(issue as z.ZodTooBigIssue).maximum})`;
      case "invalid_enum_value":
        return `${path}: Invalid value. Expected one of: ${(issue as z.ZodInvalidEnumValueIssue).options.join(", ")}`;
      default:
        return `${path}: ${issue.message}`;
    }
  });

  return issues.join("\n");
}

/**
 * Extract schema metadata for help generation.
 * Handles ZodEffects wrappers (from .refine(), .transform(), etc.)
 *
 * @param schema - Zod schema (ZodObject or ZodEffects wrapping ZodObject)
 * @returns Array of field metadata
 */
export function extractSchemaFields(schema: z.ZodType): SchemaField[] {
  const fields: SchemaField[] = [];

  // Unwrap ZodEffects to get the inner ZodObject
  let innerSchema = schema;
  while (innerSchema instanceof z.ZodEffects) {
    innerSchema = innerSchema._def.schema;
  }

  // If not a ZodObject, return empty fields
  if (!(innerSchema instanceof z.ZodObject)) {
    return fields;
  }

  const shape = innerSchema.shape;

  for (const [name, rawFieldSchema] of Object.entries(shape)) {
    const fieldSchema = rawFieldSchema as z.ZodType & { description?: string };
    const field: SchemaField = {
      name,
      type: "string",
      required: true,
      description: fieldSchema.description,
    };

    // Unwrap optional/default
    let fieldInner: z.ZodType = fieldSchema;
    if (fieldInner instanceof z.ZodOptional) {
      field.required = false;
      fieldInner = fieldInner._def.innerType;
    }
    if (fieldInner instanceof z.ZodDefault) {
      field.required = false;
      field.default = fieldInner._def.defaultValue();
      fieldInner = fieldInner._def.innerType;
    }

    // Determine type
    if (fieldInner instanceof z.ZodString) {
      field.type = "string";
    } else if (fieldInner instanceof z.ZodNumber) {
      field.type = "number";
    } else if (fieldInner instanceof z.ZodBoolean) {
      field.type = "boolean";
    } else if (fieldInner instanceof z.ZodEnum) {
      field.type = "enum";
      field.enumValues = fieldInner._def.values;
    } else if (fieldInner instanceof z.ZodEffects) {
      // Preprocessed value - try to get inner type
      field.type = "string";
    }

    fields.push(field);
  }

  return fields;
}

/**
 * Generate help text for a command.
 *
 * @param commandName - Name of the command
 * @param commandDef - Command definition
 * @returns Formatted help string
 */
export function generateCommandHelp(
  commandName: string,
  commandDef: CommandDef<unknown>
): string {
  const lines: string[] = [];
  const fields = extractSchemaFields(commandDef.schema);

  lines.push(`  ${commandName}`);
  if (commandDef.description) {
    lines.push(`    ${commandDef.description}`);
  }

  if (fields.length > 0) {
    lines.push("    Options:");
    for (const field of fields) {
      const flagName = `--${camelToKebab(field.name)}`;
      const typeStr = field.enumValues ? field.enumValues.join("|") : `<${field.type}>`;
      const reqStr = field.required ? "(required)" : field.default !== undefined ? `(default: ${field.default})` : "(optional)";
      const desc = field.description ? ` - ${field.description}` : "";
      lines.push(`      ${flagName} ${typeStr} ${reqStr}${desc}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate full help text for all commands.
 *
 * @param commands - Command map
 * @param options - CLI options
 * @returns Formatted help string
 */
export function generateHelp<TClient>(
  commands: CommandMap<TClient>,
  options?: RunCliOptions
): string {
  const lines: string[] = [];
  const programName = options?.programName || "cli";

  lines.push(`${programName}`);
  if (options?.description) {
    lines.push(`  ${options.description}`);
  }
  lines.push("");
  lines.push("Usage:");
  lines.push(`  npx tsx ${programName}.ts <command> [options]`);
  lines.push("");
  lines.push("Global Options:");
  lines.push("  --help, -h      Show this help message");
  lines.push("  --no-cache      Disable caching for this request");
  lines.push("  --verbose       Enable verbose output");
  lines.push("");
  lines.push("Commands:");

  for (const [name, def] of Object.entries(commands)) {
    lines.push(generateCommandHelp(name, def as CommandDef<unknown>));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Run the CLI with the given commands and client class.
 *
 * @param commands - Map of command names to definitions
 * @param ClientClass - Client class constructor (instantiated for each run)
 * @param options - CLI options
 */
export async function runCli<TClient>(
  commands: CommandMap<TClient>,
  ClientClass: new () => TClient,
  options?: RunCliOptions
): Promise<void> {
  const argv = process.argv.slice(2);
  const commandName = extractCommand(argv);
  const rawArgs = parseArgs(argv);
  const globals = extractGlobalFlags(rawArgs);

  // Handle help flag
  if (globals.help || !commandName || commandName === "help") {
    console.log(generateHelp(commands, options));
    process.exit(0);
  }

  // Find command
  const commandDef = commands[commandName];
  if (!commandDef) {
    console.error(JSON.stringify({
      error: true,
      message: `Unknown command: ${commandName}. Run with --help for available commands.`,
    }, null, 2));
    process.exit(1);
  }

  // Validate arguments with Zod BEFORE instantiating client
  // (so users get validation errors without needing valid config)
  const parseResult = commandDef.schema.safeParse(rawArgs);
  if (!parseResult.success) {
    console.error(JSON.stringify({
      error: true,
      message: formatZodError(parseResult.error),
    }, null, 2));
    process.exit(1);
  }

  let client: TClient | undefined;

  try {
    // Instantiate client
    client = new ClientClass();

    // Apply global flags
    if (globals.noCache && typeof (client as Record<string, unknown>).disableCache === "function") {
      (client as Record<string, () => void>).disableCache();
    }

    // Execute command
    const result = await commandDef.handler(parseResult.data, client, globals);

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exit(1);
  } finally {
    // Cleanup: call disconnect() if client has it (for MCP clients)
    if (client && typeof (client as Record<string, unknown>).disconnect === "function") {
      await (client as Record<string, () => Promise<void>>).disconnect();
    }
  }
}

/**
 * Zod helpers for common CLI patterns.
 */
export const cliTypes = {
  /**
   * Strict integer parsing (avoids JS coercion edge cases).
   * Rejects empty strings, scientific notation, etc.
   */
  int: (min?: number, max?: number) => {
    // Build inner schema with optional min/max
    let inner = z.number().int();
    if (min !== undefined) inner = inner.min(min);
    if (max !== undefined) inner = inner.max(max);

    return z.preprocess(
      (val) => {
        if (val === "" || val === undefined || val === null) return undefined;
        const num = Number(val);
        if (!Number.isInteger(num)) return NaN;
        return num;
      },
      inner
    );
  },

  /**
   * Float parsing with optional min/max.
   */
  float: (min?: number, max?: number) => {
    // Build inner schema with optional min/max
    let inner = z.number();
    if (min !== undefined) inner = inner.min(min);
    if (max !== undefined) inner = inner.max(max);

    return z.preprocess(
      (val) => {
        if (val === "" || val === undefined || val === null) return undefined;
        return Number(val);
      },
      inner
    );
  },

  /**
   * Boolean that handles "true"/"false" strings.
   */
  bool: () =>
    z.preprocess(
      (val) => {
        if (val === true || val === "true") return true;
        if (val === false || val === "false") return false;
        return undefined;
      },
      z.boolean()
    ),

  /**
   * Date string (ISO 8601 format).
   */
  date: () => z.string().datetime({ offset: true }).or(z.string().date()),

  /**
   * Pagination limit with sensible defaults.
   */
  limit: (defaultVal = 50, max = 250) =>
    z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).max(max).default(defaultVal)
    ),
};
