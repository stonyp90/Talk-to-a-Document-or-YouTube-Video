const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * Both clients use the domain and the framework-independent memory file-system
 * adapter. Metro must see these source folders outside the app directory.
 * Native code imports the adapter directly; server/provider adapters stay out
 * of the native entry graph.
 */
const config = getDefaultConfig(__dirname);
config.watchFolders = [
  path.resolve(__dirname, "../../packages/core"),
  path.resolve(__dirname, "../../packages/adapters"),
];

module.exports = config;
