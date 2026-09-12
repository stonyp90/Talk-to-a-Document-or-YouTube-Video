const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * The core is shared source, not a published package, and until now only its
 * types crossed into the native app — types vanish before Metro ever looks for
 * them. The live discussion is the first thing both clients actually run, so
 * Metro has to be told it may read outside the app directory.
 *
 * Only the core is opened up, and the core imports nothing but itself, so no
 * second copy of React or of anything else can reach the native bundle through
 * this door.
 */
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/core")];

module.exports = config;
