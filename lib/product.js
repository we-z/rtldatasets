export const PRODUCT = Object.freeze({
  productId: 'soc-dv-rlvr-diagnostic-sample-5-task',
  sku: 'SOC-DV-RLVR-DIAG-5-V1',
  artifactVersion: '2.0.0',
  packageId: 'soc-dv-gpt-5.6-luna-customer-package-v1',
  sampleId: 'soc-dv-gpt-5.6-luna-shakedown-v1',
  name: 'SoC Design + Verification RLVR Diagnostic Sample: 5 Tasks',
  archiveFilename: 'soc-dv-gpt-5.6-luna-customer-package-v2.0.0.zip',
  archiveContentType: 'application/zip',
  archiveSha256: '99ea9ecffc4f9e9d5d456b14510d6976c36b6e8be31ce246a8ee025c21d2b0bc',
  archiveBytes: 154_827,
  artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v2.0.0/sha256/99ea9ecffc4f9e9d5d456b14510d6976c36b6e8be31ce246a8ee025c21d2b0bc/soc-dv-gpt-5.6-luna-customer-package-v2.0.0.zip',
  priceCents: 100_000,
  currency: 'usd',
  termsVersion: '1.1.0',
  termsSha256: 'ed1d379b4c9d94aa5aa1ad40a7be813bb30be3567c5404170a455eabcd95f795',
  orderBindingVersion: '1.0.1',
  orderBindingSha256: '868f52938aaca2f4a97173479bae1cde576e4aca694f4966e74abef3458698b0',
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
  Object.freeze({
    artifactVersion: '1.0.2',
    archiveSha256: '24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904',
    artifactAssetPath: '/__private/artifacts/soc-dv-rlvr-diagnostic-sample-5-task/v1.0.2/sha256/24eceb7389d767099370afadbdebe8bb74a6744241f4e3957635d53ce6dbb904/soc-dv-gpt-5.3-codex-spark-customer-package-v1.0.2.zip',
    legacy: true,
  }),
]);

export const TOKEN_LIFETIMES = Object.freeze({
  checkoutStateSeconds: 24 * 60 * 60,
  browserRecoverySeconds: 7 * 24 * 60 * 60,
  entitlementSeconds: 12 * 60 * 60,
  redeemSeconds: 30 * 24 * 60 * 60,
});
