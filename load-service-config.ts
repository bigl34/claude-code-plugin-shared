
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { z, ZodError } from "zod";

type AssistantPathsModule = {
  getBizRoot: () => string;
  resolveCredentialConfigPath: (fileName: string) => string | null;
};

async function loadAssistantPaths(): Promise<AssistantPathsModule> {
  const candidates = [
    new URL("../assistant-paths.mjs", import.meta.url),
    new URL("../../assistant-paths.mjs", import.meta.url),
  ];
  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) {
      return (await import(candidate.href)) as AssistantPathsModule;
    }
  }
  throw new Error(
    `loadServiceConfig: could not locate assistant-paths.mjs from ${import.meta.url}`,
  );
}

const { getBizRoot, resolveCredentialConfigPath } = await loadAssistantPaths();

const DEFAULT_REMEDY =
  "Run cred-loader-sync to regenerate, or set BIZ_CREDENTIAL_CONFIG_ROOTS to override.";

export interface LoadServiceConfigOptions<T> {
  schema?: z.ZodSchema<T>;
  remedy?: string;
  optional?: boolean;
  defaults?: Partial<T>;
}

export function loadServiceConfig<T>(
  serviceName: string,
  opts: LoadServiceConfigOptions<T> & { optional: true },
): T | null;
export function loadServiceConfig<T>(
  serviceName: string,
  opts?: LoadServiceConfigOptions<T>,
): T;
export function loadServiceConfig<T>(
  serviceName: string,
  opts?: LoadServiceConfigOptions<T>,
): T | null {
  const tried: string[] = [];
  let resolvedPath: string | null = null;

  const credentialPath = resolveCredentialConfigPath(`${serviceName}.json`);
  if (credentialPath) {
    tried.push(credentialPath);
    if (existsSync(credentialPath)) {
      resolvedPath = credentialPath;
    }
  }

  if (!resolvedPath) {
    const legacyPath = join(getBizRoot(), "scripts", serviceName, "config.json");
    if (!tried.includes(legacyPath)) {
      tried.push(legacyPath);
    }
    if (existsSync(legacyPath)) {
      resolvedPath = legacyPath;
    }
  }

  if (!resolvedPath) {
    if (opts?.optional === true) {
      return null;
    }
    const remedy = opts?.remedy ?? DEFAULT_REMEDY;
    throw new Error(
      `Missing config for ${serviceName}. Tried: ${tried.join(", ")}. ${remedy}`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolvedPath, "utf-8"));
  } catch (err) {
    const parseDetail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Invalid JSON in config for ${serviceName} at ${resolvedPath}: ${parseDetail}. ${DEFAULT_REMEDY}`,
    );
  }

  if (opts?.defaults !== undefined && raw !== null && typeof raw === "object") {
    raw = { ...opts.defaults, ...(raw as Record<string, unknown>) };
  }

  if (!opts?.schema) {
    return raw as T;
  }

  try {
    return opts.schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Invalid config for ${serviceName} at ${resolvedPath}:\n${issues}`,
      );
    }
    throw err;
  }
}

export interface NormalizeLegacyMcpConfigOptions {
  legacyTopLevel?: Record<string, string>;
}

export function normalizeLegacyMcpConfig(
  raw: unknown,
  legacyEnvMap: Record<string, string>,
  options?: NormalizeLegacyMcpConfigOptions,
): unknown {
  if (raw === null || typeof raw !== "object") {
    return raw;
  }

  const cloned = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;

  if (options?.legacyTopLevel) {
    for (const [destPath, topLevelKey] of Object.entries(options.legacyTopLevel)) {
      const topLevelValue = cloned[topLevelKey];
      const newValue = readDotted(cloned, destPath);

      const topLevelPresent =
        topLevelValue !== undefined && topLevelValue !== null;
      const newPresent = newValue !== undefined && newValue !== null;

      if (topLevelPresent && newPresent && topLevelValue !== newValue) {
        throw new Error(
          `Conflicting config for ${destPath}: legacy top-level ${topLevelKey} ` +
            `and new ${destPath} are both set with different values. ` +
            `Remove one to resolve.`,
        );
      }

      if (topLevelPresent && !newPresent) {
        writeDotted(cloned, destPath, topLevelValue);
      }
    }
  }

  const legacyEnv = readDotted(cloned, "mcpServer.env");
  const legacyEnvObj =
    legacyEnv !== undefined &&
    legacyEnv !== null &&
    typeof legacyEnv === "object"
      ? (legacyEnv as Record<string, unknown>)
      : null;

  for (const [destPath, envName] of Object.entries(legacyEnvMap)) {
    const legacyValue = legacyEnvObj ? legacyEnvObj[envName] : undefined;
    const newValue = readDotted(cloned, destPath);

    const legacyPresent = legacyValue !== undefined && legacyValue !== null;
    const newPresent = newValue !== undefined && newValue !== null;

    if (legacyPresent && newPresent && legacyValue !== newValue) {
      throw new Error(
        `Conflicting config for ${destPath}: legacy mcpServer.env.${envName} ` +
          `and new ${destPath} are both set with different values. ` +
          `Remove one to resolve.`,
      );
    }

    if (legacyPresent && !newPresent) {
      writeDotted(cloned, destPath, legacyValue);
    }
  }

  return cloned;
}

function readDotted(obj: Record<string, unknown>, dotted: string): unknown {
  const segments = dotted.split(".");
  let cursor: unknown = obj;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function writeDotted(
  obj: Record<string, unknown>,
  dotted: string,
  value: unknown,
): void {
  const segments = dotted.split(".");
  const finalSegment = segments[segments.length - 1];
  if (!finalSegment) {
    return;
  }
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!segment) {
      continue;
    }
    const next = cursor[segment];
    if (next === null || typeof next !== "object") {
      const fresh: Record<string, unknown> = {};
      cursor[segment] = fresh;
      cursor = fresh;
    } else {
      cursor = next as Record<string, unknown>;
    }
  }
  cursor[finalSegment] = value;
}

export function getServiceModuleDir(serviceName: string): string {
  return join(getBizRoot(), "scripts", serviceName);
}

export interface LoadPassCredentialsOptions {
  prefix: string;
  keys: string[];
  optional?: boolean;
}

export function loadPassCredentials(
  opts: LoadPassCredentialsOptions,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  for (const key of opts.keys) {
    const fullEntry = `${opts.prefix}/${key}`;
    let value: string | null = null;

    try {
      const stdout = execFileSync("pass", [fullEntry], {
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const trimmed = stdout.trim();
      value = trimmed.length > 0 ? trimmed : null;
    } catch {
      value = null;
    }

    if (value === null && opts.optional !== true) {
      throw new Error(
        `Missing pass credential at ${fullEntry}. ` +
          `Add it with: pass insert ${fullEntry}`,
      );
    }

    result[key] = value;
  }

  return result;
}
