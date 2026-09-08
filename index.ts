
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
  TrustLevel,
  WrappedField,
  SafeOutput,
  WrapFieldOptions,
  SideEffect,
} from "./types.js";

export {
  parseArgs,
  extractCommand,
  extractGlobalFlags,
  kebabToCamel,
  camelToKebab,
} from "./parser.js";

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

export {
  wrapUntrustedField,
  buildSafeOutput,
  htmlToSafeText,
  truncateContent,
  detectSuspiciousContent,
  TRUNCATION_DEFAULTS,
} from "./content-safety.js";

export {
  loadServiceConfig,
  normalizeLegacyMcpConfig,
  getServiceModuleDir,
  loadPassCredentials,
} from "./load-service-config.js";
export type {
  LoadServiceConfigOptions,
  NormalizeLegacyMcpConfigOptions,
  LoadPassCredentialsOptions,
} from "./load-service-config.js";

export {
  ShopifyServiceConfigSchema,
  SHOPIFY_CONFIG_SCHEMA_VERSION,
  SHOPIFY_ACCESS_TOKEN_ENV_KEY,
  SHOPIFY_STORE_DOMAIN_ENV_KEY,
  parseShopifyServiceConfig,
  resolveShopifyAdminCredentials,
  resolveShopifyAccessToken,
} from "./shopify-credentials.js";
export type {
  ShopifyServiceConfig,
  ShopifyCredentialSource,
  ShopifyAdminCredentials,
} from "./shopify-credentials.js";

export { z } from "zod";
