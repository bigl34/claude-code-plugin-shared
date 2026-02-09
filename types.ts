/**
 * @local/cli-utils Type Definitions
 *
 * Shared types for Zod-based CLI validation.
 */

import { z } from "zod";

/**
 * Parsed command-line arguments as key-value pairs.
 * All values are strings at this stage (before Zod validation).
 */
export type RawArgs = Record<string, string | boolean>;

/**
 * Global flags that apply to all commands.
 */
export interface GlobalFlags {
  noCache?: boolean;
  help?: boolean;
  verbose?: boolean;
}

/**
 * Command handler function type.
 * @param args - Validated arguments from Zod schema
 * @param client - Instantiated client class
 * @param globals - Global flags
 */
export type CommandHandler<TArgs, TClient, TResult = unknown> = (
  args: TArgs,
  client: TClient,
  globals: GlobalFlags
) => Promise<TResult>;

/**
 * Command definition combining schema and handler.
 */
export interface CommandDef<TClient> {
  schema: z.ZodType;
  handler: CommandHandler<unknown, TClient>;
  description?: string;
}

/**
 * Map of command names to their definitions.
 */
export type CommandMap<TClient> = Record<string, CommandDef<TClient>>;

/**
 * Options for runCli.
 */
export interface RunCliOptions {
  /** Custom global flags schema (merged with defaults) */
  globals?: z.ZodObject<z.ZodRawShape>;
  /** Program name for help text */
  programName?: string;
  /** Program description for help text */
  description?: string;
}

/**
 * Result of CLI execution (for testing).
 */
export interface CliResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  exitCode: number;
}

/**
 * Schema metadata extracted for help generation.
 */
export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
  enumValues?: string[];
}

/**
 * Command metadata for help generation.
 */
export interface CommandMeta {
  name: string;
  description?: string;
  fields: SchemaField[];
}
