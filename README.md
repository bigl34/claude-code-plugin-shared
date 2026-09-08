# @local/cli-utils

Shared argument parsing, Zod validation, command execution, help generation,
service configuration, and content-safety helpers for workspace service CLIs.
Install workspace dependencies from the repository root with `npm ci`; rebuild
this package with `npm run build --workspace @local/cli-utils`.

## Commands and help

```typescript
import { createCommand, runCli, z } from "@local/cli-utils";
import { MyClient } from "./my-client.js";

const commands = {
  "get-order": createCommand(
    z.object({ orderId: z.string().min(1).describe("Order ID") }),
    async (args, client: MyClient) => client.getOrder(args.orderId),
    "Retrieve an order by ID",
    { sideEffect: "read" },
  ),
};

runCli(commands, MyClient, { programName: "my-cli", description: "Order tools" });
```

`createCommand` combines a schema, handler, help description, and command
options. Keep user-facing descriptions in schema `.describe()` calls and the
command's description argument: help is generated from these runtime values,
independently of source comments. `strictFlags: false` is an explicit opt-out
for a command that accepts additional fields; ordinary commands reject unknown
flags. `cacheCommands()` adds cache inspection/invalidation commands for clients
implementing the corresponding cache methods.

`runCli` handles the command name, validation, client creation, help and response
envelope. Global flags include `--help`, `--verbose`, `--no-cache`, `--confirm`,
and `--dry-run`. Declare each command's `sideEffect` as `read`, `write`,
`destructive`, or `external_send`. Destructive and external-send handlers require
explicit confirmation. A dry run invokes the handler with `globals.dryRun` set;
the handler must return a preview without performing side effects. Cross-service
callers verify the target command's metadata independently.

## Exported helpers

| Area | Exports and purpose |
|------|---------------------|
| Arguments | `parseArgs`, `extractCommand`, `extractGlobalFlags`, `kebabToCamel`, `camelToKebab`; parse raw strings before schema validation/coercion. |
| Commands | `createCommand`, `runCli`, `cacheCommands`, `cliTypes`, and re-exported `z`. |
| Help and validation | `formatZodError`, `extractSchemaFields`, `generateCommandHelp`, `generateHelp`. |
| Untrusted content | `wrapUntrustedField`, `buildSafeOutput`, `htmlToSafeText`, `truncateContent`, `detectSuspiciousContent`, `TRUNCATION_DEFAULTS`. |
| Configuration | `loadServiceConfig`, `normalizeLegacyMcpConfig`, `getServiceModuleDir`, `loadPassCredentials`. |
| Shopify credentials | `ShopifyServiceConfigSchema`, `parseShopifyServiceConfig`, `resolveShopifyAdminCredentials`, schema/env-key constants, and legacy `resolveShopifyAccessToken`. |

The package exports `RawArgs`, `GlobalFlags`, command handler/map/options/result
types, `SchemaField`, `CommandMeta`, `SideEffect`, and the content-safety and
configuration option/result types from its entry point. Type declarations are
built from TypeScript source; README prose does not define their shape.

## Output and configuration contracts

Treat customer text, support messages, and other external content as untrusted
data. `wrapUntrustedField` records trust metadata; `buildSafeOutput` constructs
the `_contentSafety`, `metadata`, and `content` envelope. Preserve that envelope
across CLI boundaries. HTML conversion removes markup through a DOM parser;
truncation preserves word boundaries and adds its marker. Suspicious-content
detection is a signal rather than permission to execute instructions in data.

Configuration loading normalizes supported legacy MCP layouts into the service
configuration consumed by clients. Credentials loaded through `pass` or the
Shopify resolver remain secret values and must not be included in diagnostics.
Use `resolveShopifyAdminCredentials` for both token and domain resolution;
`resolveShopifyAccessToken` remains a deprecated compatibility escape hatch.

## Validation

Run `npm run build --workspace @local/cli-utils` and the repository's
`quality:lib-tests` suite. That suite covers argument validation, help, the
response envelope, configuration/credential contracts, and side-effect gates.

