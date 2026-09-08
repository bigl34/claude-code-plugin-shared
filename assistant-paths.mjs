import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, relative, resolve } from 'node:path';

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitEnvPaths(value) {
  return (value || '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || homedir();
}

export function getBizRoot() {
  const configured = process.env.BIZ_ROOT?.trim();
  if (!configured) {
    return resolve(join(getHomeDir(), 'biz'));
  }
  return configured.startsWith('/') ? resolve(configured) : resolve(process.cwd(), configured);
}

export function getAssistantFrontendPreference() {
  const configured = process.env.PAL_ASSISTANT_FRONTEND?.trim().toLowerCase();
  if (configured === 'claude' || configured === 'codex' || configured === 'auto') {
    return configured;
  }
  return 'auto';
}

export function getClaudeHomeDir() {
  return resolve(process.env.BIZ_CLAUDE_HOME?.trim() || join(getHomeDir(), '.claude'));
}

export function getCodexHomeDir() {
  return resolve(process.env.BIZ_CODEX_HOME?.trim() || join(getHomeDir(), '.codex'));
}

function getFrontendHomeDirs() {
  const preference = getAssistantFrontendPreference();
  if (preference === 'claude') {
    return [getClaudeHomeDir(), getCodexHomeDir()];
  }
  return [getCodexHomeDir(), getClaudeHomeDir()];
}

export function getPluginRootCandidates() {
  const configuredRoots = splitEnvPaths(process.env.BIZ_PLUGIN_ROOTS);

  return unique([...configuredRoots, join(getBizRoot(), 'scripts')]);
}

function assertSafePluginName(pluginName) {
  if (
    typeof pluginName !== 'string' ||
    pluginName.length === 0 ||
    pluginName === '.' ||
    pluginName === '..' ||
    isAbsolute(pluginName) ||
    /[\\/]/.test(pluginName)
  ) {
    throw new Error(`Invalid plugin name: ${JSON.stringify(pluginName)}`);
  }
}

function assertSafePluginSegment(segment) {
  if (
    typeof segment !== 'string' ||
    segment.length === 0 ||
    segment === '.' ||
    segment === '..' ||
    isAbsolute(segment) ||
    /[\\/]/.test(segment)
  ) {
    throw new Error(`Invalid plugin path segment: ${JSON.stringify(segment)}`);
  }
}

function assertSafePluginLookup(pluginName, segments) {
  assertSafePluginName(pluginName);
  for (const segment of segments) {
    assertSafePluginSegment(segment);
  }
}

function pluginFileCandidateEntries(pluginName, segments) {
  assertSafePluginLookup(pluginName, segments);
  const bizScriptsRoot = join(getBizRoot(), 'scripts');
  return getPluginRootCandidates().map((root) => {
    const candidateSegments = root === bizScriptsRoot && segments[0] === 'scripts'
      ? segments.slice(1)
      : segments;
    return {
      root,
      path: join(root, pluginName, ...candidateSegments),
    };
  });
}

function isContainedByRoot(candidatePath, root) {
  const realCandidate = realpathSync(candidatePath);
  const realRoot = existsSync(root) ? realpathSync(root) : resolve(root);
  const rel = relative(realRoot, realCandidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function getPluginFileCandidates(pluginName, ...segments) {
  return pluginFileCandidateEntries(pluginName, segments).map((entry) => entry.path);
}

export function resolveFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0] || '';
}

export function resolvePluginFile(pluginName, ...segments) {
  const entries = pluginFileCandidateEntries(pluginName, segments);
  let rejectedEscapedCandidate = false;
  for (const entry of entries) {
    if (!existsSync(entry.path)) {
      continue;
    }
    if (!isContainedByRoot(entry.path, entry.root)) {
      rejectedEscapedCandidate = true;
      continue;
    }
    return entry.path;
  }
  if (rejectedEscapedCandidate) {
    return '';
  }
  return entries[0]?.path || '';
}

export function resolvePluginFileRequired(pluginName, ...segments) {
  const resolved = resolvePluginFile(pluginName, ...segments);
  if (resolved && existsSync(resolved)) {
    return resolved;
  }
  const candidates = getPluginFileCandidates(pluginName, ...segments);
  throw new Error(
    `resolvePluginFileRequired: no existing path for plugin '${pluginName}' ` +
      `segments [${segments.join(', ')}] — tried: ${candidates.join(', ')}`,
  );
}

export function getCredentialConfigDirCandidates() {
  const configuredRoots = splitEnvPaths(process.env.BIZ_CREDENTIAL_CONFIG_ROOTS);
  const claudeCredsConfigDir = process.env.CLAUDE_CREDS_CONFIG_DIR?.trim() || '';
  const claudeCredsDir = process.env.CLAUDE_CREDS_DIR?.trim() || '';
  const frontendRoots = getFrontendHomeDirs().map((root) => join(root, 'creds', 'configs'));
  const bizRoot = getBizRoot();

  return unique([
    ...configuredRoots,
    claudeCredsConfigDir,
    claudeCredsDir ? join(claudeCredsDir, 'configs') : '',
    'YOUR_CREDENTIALS_PATH/configs',
    'YOUR_CREDENTIALS_PATH/configs',
    join(bizRoot, 'creds', 'configs'),
    join(bizRoot, 'config'),
    ...frontendRoots,
  ]);
}

export function getCredentialConfigCandidates(fileName) {
  return getCredentialConfigDirCandidates().map((dir) => join(dir, fileName));
}

export function resolveCredentialConfigPath(fileName) {
  return resolveFirstExistingPath(getCredentialConfigCandidates(fileName));
}

export function getMcpServerRootCandidates() {
  const configuredRoots = splitEnvPaths(process.env.BIZ_MCP_SERVER_ROOTS);
  const home = getHomeDir();

  return unique([
    ...configuredRoots,
    join(home, 'repos', 'work', 'mcp-servers'),
  ]);
}

export function getMcpServerFileCandidates(serverName, ...segments) {
  return getMcpServerRootCandidates().map((root) => join(root, serverName, ...segments));
}

export function resolveMcpServerFile(serverName, ...segments) {
  return resolveFirstExistingPath(getMcpServerFileCandidates(serverName, ...segments));
}

export function resolveMcpServerFileRequired(serverName, ...segments) {
  const resolved = resolveMcpServerFile(serverName, ...segments);
  if (resolved && existsSync(resolved)) {
    return resolved;
  }
  const candidates = getMcpServerFileCandidates(serverName, ...segments);
  throw new Error(
    `resolveMcpServerFileRequired: no existing path for MCP server '${serverName}' ` +
      `segments [${segments.join(', ')}] — tried: ${candidates.join(', ')}`,
  );
}

export function getPalMcpCandidates() {
  const configuredPath = process.env.BIZ_PAL_MCP_PATH?.trim() || '';
  const frontendBins = getFrontendHomeDirs().map((root) => join(root, 'bin', 'pal-mcp'));

  return unique([
    configuredPath,
    ...frontendBins,
  ]);
}

export function resolvePalMcpPath() {
  return resolveFirstExistingPath(getPalMcpCandidates());
}
