module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    require: ["tests/bdd/steps.ts"],
    requireModule: ["tsx/cjs"],
    format: ["progress"],
    // Pending/undefined scenarios must fail the full acceptance gate.
    strict: true,
    retry: 0,
  },
};
