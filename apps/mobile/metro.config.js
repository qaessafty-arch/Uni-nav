// Expo SDK 52+ auto-detects pnpm/yarn workspaces; this file only enables package "exports".
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
module.exports = config;
