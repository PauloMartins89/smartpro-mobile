const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

// Monorepo: watch only root node_modules (not entire monorepo to avoid ENOENT in other apps)
config.watchFolders = [path.resolve(monorepoRoot, 'node_modules')];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force CJS resolution for @supabase/supabase-js (ESM dynamic imports not supported by Hermes)
// Use monorepo root node_modules as source of truth
const supabaseLocalCjs = path.resolve(__dirname, 'node_modules/@supabase/supabase-js/dist/index.cjs');
const supabaseRootCjs  = path.resolve(monorepoRoot, 'node_modules/@supabase/supabase-js/dist/index.cjs');
const fs = require('fs');
const supabaseCjsPath = fs.existsSync(supabaseLocalCjs) ? supabaseLocalCjs : supabaseRootCjs;

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return { filePath: supabaseCjsPath, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
