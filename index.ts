/**
 * @local/cli-utils
 *
 * Shared CLI utilities with Zod validation for plugin CLIs.
 *
 * Features:
 * - Schema-based argument validation with Zod
 * - Automatic type coercion (string → number, boolean)
 * - Auto-generated help text from schema descriptions
 * - Consistent error message formatting
 * - Pre-built cache commands
 * - Global flags support (--no-cache, --help, --verbose)
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { createCommand, runCli, cacheCommands, cliTypes } from "@local/cli-utils";
 * import { MyClient } from "./my-client.js";
 *
 * const commands = {
 *   "get-order": createCommand(
 *     z.object({
 *       orderId: z.string().min(1).describe("Order ID"),
 *       limit: cliTypes.limit(50, 250),
 *     }),
 *     async (args, client) => client.getOrder(args.orderId),
 *     "Retrieve an order by ID"
 *   ),
 *   ...cacheCommands(),
 * };
 *
 * runCli(commands, MyClient, {
 *   programName: "my-cli",
 *   description: "My CLI tool",
 * });
 * ```
 */

// Types
export type {
  RawArgs,
  GlobalFlags,
  CommandHandler,
  CommandDef,
  CommandMap,
  RunCliOptions,
  CliResult,
  SchemaField,
  CommandMeta,
} from "./types.js";

// Parser utilities
export {
  parseArgs,
  extractCommand,
  extractGlobalFlags,
  kebabToCamel,
  camelToKebab,
} from "./parser.js";

// Validator and CLI runner
export {
  createCommand,
  cacheCommands,
  formatZodError,
  extractSchemaFields,
  generateCommandHelp,
  generateHelp,
  runCli,
  cliTypes,
} from "./validator.js";

// Re-export Zod for convenience
export { z } from "zod";
