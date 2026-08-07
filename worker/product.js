export const PRODUCT = Object.freeze({
  productId: 'soc-dv-rlvr-diagnostic-sample-5-task',
  sku: 'SOC-DV-RLVR-DIAG-5-V1',
  artifactVersion: '1.0.2',
  packageId: 'soc-dv-gpt-5.3-codex-spark-customer-package-v1',
  sampleId: 'soc-dv-gpt-5.3-codex-spark-shakedown-v1',
  name: 'SoC Design + Verification RLVR Diagnostic Sample: 5 Tasks',
  archiveFilename: 'soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip',
  archiveContentType: 'application/zip',
  archiveSha256: '24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904',
  archiveBytes: 164_691,
  artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v1.0.2/sha256/24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904/soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip',
  priceCents: 100_000,
  currency: 'usd',
  termsVersion: '1.0.0',
  termsSha256: '9641c0bf29ce31557b7f6bdc221b429c86456c48c9019355c3e00c5bdd6e0530',
  orderBindingVersion: '1.0.0',
  orderBindingSha256: 'c58f427f07c8199ba756b82ff0be822df80016ee2dfe3342b11c826a19fc6f0f',
  acceptanceMethod: 'web_checkbox_post_v1',
  supportEmail: 'root@puul.ai',
});

// Existing paid sessions remain recoverable after the corrected-artifact
// cutover. These bindings are accepted only as historical Stripe metadata;
// authorized downloads always serve PRODUCT.artifactAssetPath above.
export const LEGACY_CHECKOUT_ARTIFACTS = Object.freeze([
  Object.freeze({
    artifactVersion: '1.0.0',
    archiveSha256: 'ddecf9fc5e0057d4a884b2537ea7e2c973235714fa731e9b68e5dbc8432b1dfc',
    artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v1.0.0/sha256/ddecf9fc5e0057d4a884b2537ea7e2c973235714fa731e9b68e5dbc8432b1dfc/soc-dv-rlvr-diagnostic-sample-5-task-v1.0.0.tar.gz',
    legacy: true,
  }),
]);

export const TOKEN_LIFETIMES = Object.freeze({
  checkoutStateSeconds: 24 * 60 * 60,
  browserRecoverySeconds: 7 * 24 * 60 * 60,
  entitlementSeconds: 12 * 60 * 60,
  redeemSeconds: 30 * 24 * 60 * 60,
});
