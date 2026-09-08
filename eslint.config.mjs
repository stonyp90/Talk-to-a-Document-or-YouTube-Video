import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    // Build products and vendored worker code are not authored application code.
    // Native exports can otherwise make a root lint parse megabytes of bundles.
    ignores: [
      "apps/mobile/ios/**",
      "apps/mobile/android/**",
      "apps/mobile/dist/**",
      "apps/mobile/.expo/**",
      "infrastructure/cdk/cdk.out/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "public/pdf.worker.mjs",
    ],
  },
];

export default config;
