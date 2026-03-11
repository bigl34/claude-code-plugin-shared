<!-- AUTO-GENERATED README — DO NOT EDIT. Changes will be overwritten on next publish. -->
# @local/cli-utils

Shared CLI utilities with Zod validation for plugin CLIs

![License: MIT](https://img.shields.io/badge/License-MIT-green)

## Features

- Schema-based argument validation with Zod
- Automatic type coercion (string → number, boolean)
- Auto-generated help text from schema descriptions
- Consistent error message formatting
- Pre-built cache commands
- Global flags support (--no-cache, --help, --verbose)

## Installation

This package is designed as a workspace dependency for Claude Code plugin CLIs.

Add to your plugin's `package.json`:

```bash
npm install
```

## Quick Start

```typescript
import { z } from "zod";
import { createCommand, runCli, cacheCommands, cliTypes } from "@local/cli-utils";
import { MyClient } from "./my-client.js";

const commands = {
  "get-order": createCommand(
    z.object({
      orderId: z.string().min(1).describe("Order ID"),
      limit: cliTypes.limit(50, 250),
    }),
    async (args, client) => client.getOrder(args.orderId),
    "Retrieve an order by ID"
  ),
  ...cacheCommands(),
};

runCli(commands, MyClient, {
  programName: "my-cli",
  description: "My CLI tool",
});
```

## API Reference

### Parser

| Export               | Description                                     |
| -------------------- | ----------------------------------------------- |
| `parseArgs`          | Parse command-line arguments into a raw object. |
| `extractCommand`     | Extract the command name from argv.             |
| `extractGlobalFlags` | Extract global flags from parsed args.          |
| `kebabToCamel`       | Convert kebab-case to camelCase.                |
| `camelToKebab`       | Convert camelCase to kebab-case.                |

### Validator

| Export                | Description                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| `createCommand`       | Create a command definition with schema and handler.                           |
| `cacheCommands`       | Pre-built cache commands that work with any client implementing cache methods. |
| `formatZodError`      | Format a Zod error into a user-friendly message.                               |
| `extractSchemaFields` | Extract schema metadata for help generation.                                   |
| `generateCommandHelp` | Generate help text for a command.                                              |
| `generateHelp`        | Generate full help text for all commands.                                      |
| `runCli`              | Run the CLI with the given commands and client class.                          |
| `cliTypes`            | Zod helpers for common CLI patterns.                                           |

### Types

| Type             | Kind      | Description                                                                                                     |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `RawArgs`        | type      | Parsed command-line arguments as key-value pairs. All values are strings at this stage (before Zod validation). |
| `GlobalFlags`    | interface | Global flags that apply to all commands.                                                                        |
| `CommandHandler` | type      | Command handler function type.                                                                                  |
| `CommandDef`     | interface | Command definition combining schema and handler.                                                                |
| `CommandMap`     | type      | Map of command names to their definitions.                                                                      |
| `RunCliOptions`  | interface | Options for runCli.                                                                                             |
| `CliResult`      | interface | Result of CLI execution (for testing).                                                                          |
| `SchemaField`    | interface | Schema metadata extracted for help generation.                                                                  |
| `CommandMeta`    | interface | Command metadata for help generation.                                                                           |

## License

MIT
