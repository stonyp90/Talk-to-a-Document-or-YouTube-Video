const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withARScene(config) {
  return withXcodeProject(config, (exportedConfig) => {
    return exportedConfig;
  });
};
