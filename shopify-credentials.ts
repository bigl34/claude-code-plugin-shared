
import { z } from "zod";

export const SHOPIFY_CONFIG_SCHEMA_VERSION = 1;

const KNOWN_SCHEMA_VERSIONS: ReadonlySet<number> = new Set([
  SHOPIFY_CONFIG_SCHEMA_VERSION,
]);

export const SHOPIFY_ACCESS_TOKEN_ENV_KEY = "SHOPIFY_ACCESS_TOKEN";

export const SHOPIFY_STORE_DOMAIN_ENV_KEY = "MYSHOPIFY_DOMAIN";

const LEGACY_TOKEN_FLAGS: ReadonlySet<string> = new Set([
  "--accessToken",
  "--access-token",
  "--token",
]);

const LEGACY_DOMAIN_FLAGS: ReadonlySet<string> = new Set([
  "--domain",
  "--store-domain",
]);

export const ShopifyServiceConfigSchema = z.object({
  _schemaVersion: z.number().optional(),
  mcpServer: z.object({
    command: z.string().optional(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
  }),
  storeDomain: z.string().min(1).optional(),
  apiVersion: z.string().optional(),
});

export type ShopifyServiceConfig = z.infer<typeof ShopifyServiceConfigSchema>;

export type ShopifyCredentialSource =
  | "config-env"
  | "config-top-level"
  | "legacy-argv";

export interface ShopifyAdminCredentials {
  accessToken: string;
  storeDomain: string;
  source: {
    accessToken: Extract<ShopifyCredentialSource, "config-env" | "legacy-argv">;
    storeDomain: ShopifyCredentialSource;
  };
}

const emittedDeprecations = new Set<string>();

function warnLegacyArgv(credentialLabel: string): void {
  if (emittedDeprecations.has(credentialLabel)) {
    return;
  }
  emittedDeprecations.add(credentialLabel);
  process.emitWarning(
    `shopify-order-manager config supplied ${credentialLabel} via the retired ` +
      `mcpServer.args form. Run cred-loader-sync to regenerate the config with ` +
      `mcpServer.env. Argv support is a migration shim and will be removed.`,
    "DeprecationWarning",
  );
}

function readFlagValue(
  args: readonly string[],
  flags: ReadonlySet<string>,
): string | null {
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    for (const flag of flags) {
      if (argument.startsWith(`${flag}=`)) {
        const inlineValue = argument.slice(flag.length + 1);
        if (inlineValue) {
          return inlineValue;
        }
      }
    }

    if (flags.has(argument)) {
      const nextArgument = args[index + 1];
      if (nextArgument && !nextArgument.startsWith("--")) {
        return nextArgument;
      }
    }
  }

  return null;
}

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function chooseCredential(
  credentialLabel: string,
  canonicalValue: string | null,
  canonicalSource: ShopifyCredentialSource,
  legacyValue: string | null,
): { value: string; source: ShopifyCredentialSource } | null {
  const hasCanonical = canonicalValue !== null;
  const hasLegacy = legacyValue !== null;

  if (hasCanonical && hasLegacy && canonicalValue !== legacyValue) {
    throw new Error(
      `Conflicting ${credentialLabel} in shopify-order-manager config: ` +
        `${canonicalSource} and legacy mcpServer.args disagree. ` +
        `Run cred-loader-sync to regenerate a single canonical value.`,
    );
  }

  if (hasCanonical) {
    return { value: canonicalValue, source: canonicalSource };
  }

  if (hasLegacy) {
    warnLegacyArgv(credentialLabel);
    return { value: legacyValue, source: "legacy-argv" };
  }

  return null;
}

export function parseShopifyServiceConfig(raw: unknown): ShopifyServiceConfig {
  const parsed = ShopifyServiceConfigSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid shopify-order-manager config shape:\n${issues}\n` +
      `Run cred-loader-sync to regenerate the config.`,
  );
}

export function resolveShopifyAdminCredentials(
  raw: unknown,
): ShopifyAdminCredentials {
  const config = parseShopifyServiceConfig(raw);

  const declaredVersion = config._schemaVersion;
  if (declaredVersion !== undefined && !KNOWN_SCHEMA_VERSIONS.has(declaredVersion)) {
    throw new Error(
      `Unsupported shopify-order-manager config _schemaVersion ${declaredVersion}. ` +
        `This build understands ${[...KNOWN_SCHEMA_VERSIONS].join(", ")}. ` +
        `Update @local/cli-utils, or regenerate the config with a matching cred-loader.`,
    );
  }

  const argv = config.mcpServer.args;
  const configEnv = config.mcpServer.env ?? {};

  const token = chooseCredential(
    "Shopify Admin API access token",
    nonEmpty(configEnv[SHOPIFY_ACCESS_TOKEN_ENV_KEY]),
    "config-env",
    nonEmpty(readFlagValue(argv, LEGACY_TOKEN_FLAGS)),
  );
  if (!token) {
    throw new Error(
      `shopify-order-manager config has no Shopify Admin API access token. ` +
        `Expected mcpServer.env.${SHOPIFY_ACCESS_TOKEN_ENV_KEY}. ` +
        `Run cred-loader-sync to regenerate the config.`,
    );
  }

  const topLevelDomain = nonEmpty(config.storeDomain);
  const envDomain = nonEmpty(configEnv[SHOPIFY_STORE_DOMAIN_ENV_KEY]);
  if (topLevelDomain && envDomain && topLevelDomain !== envDomain) {
    throw new Error(
      `Conflicting Shopify store domain in shopify-order-manager config: ` +
        `top-level storeDomain and mcpServer.env.${SHOPIFY_STORE_DOMAIN_ENV_KEY} disagree. ` +
        `Run cred-loader-sync to regenerate a single canonical value.`,
    );
  }

  const canonicalDomain = topLevelDomain ?? envDomain;
  const canonicalDomainSource: ShopifyCredentialSource = topLevelDomain
    ? "config-top-level"
    : "config-env";
  const domain = chooseCredential(
    "Shopify store domain",
    canonicalDomain,
    canonicalDomainSource,
    nonEmpty(readFlagValue(argv, LEGACY_DOMAIN_FLAGS)),
  );
  if (!domain) {
    throw new Error(
      `shopify-order-manager config has no Shopify store domain. ` +
        `Expected top-level storeDomain or mcpServer.env.${SHOPIFY_STORE_DOMAIN_ENV_KEY}. ` +
        `Run cred-loader-sync to regenerate the config.`,
    );
  }

  return {
    accessToken: token.value,
    storeDomain: domain.value,
    source: {
      accessToken: token.source as "config-env" | "legacy-argv",
      storeDomain: domain.source,
    },
  };
}

/**
 * @deprecated
 */
export function resolveShopifyAccessToken(
  args: readonly string[],
  configEnv: Readonly<Record<string, string>>,
  processEnv: Readonly<Record<string, string | undefined>>,
): string {
  const fromArgs = nonEmpty(readFlagValue(args, LEGACY_TOKEN_FLAGS));
  if (fromArgs) {
    warnLegacyArgv("Shopify Admin API access token");
    return fromArgs;
  }

  const fromEnv =
    nonEmpty(configEnv[SHOPIFY_ACCESS_TOKEN_ENV_KEY]) ??
    nonEmpty(processEnv[SHOPIFY_ACCESS_TOKEN_ENV_KEY]);
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error(
    `No Shopify Admin API access token — expected mcpServer.env.${SHOPIFY_ACCESS_TOKEN_ENV_KEY}.`,
  );
}
