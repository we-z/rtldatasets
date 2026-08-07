# Terms, parties, and order binding

Supplement version 1.0.0 — effective August 4, 2026

This document identifies the parties and records required for delivery. It
clarifies `SAMPLE_LICENSE.md` version `1.0.0`; it does not replace that license,
reduce rights already granted under it, or override an applicable signed
commercial agreement.

## Contracting parties

**Seller** means the legal person or entity identified as the seller or
merchant in the external purchase record bound to this archive's SHA-256. The
Seller operates the `RTL Datasets` product name. The record must contain the
Seller's legal name and a durable contact address; a trade name alone is not
sufficient.

**Customer** means the legal person or entity identified as the purchaser in
that same record. If checkout captured only an email address, the record must
be completed with the purchaser's legal name and, when applicable, organization
before delivery.

## Authorized organizational users

When the Customer is an organization, its employees and individual contractors
may use the Sample on the Customer's behalf solely for the Customer's internal
purposes described in `SAMPLE_LICENSE.md`. They must be subject to
confidentiality and use restrictions at least as protective as the accepted
terms. The Customer remains responsible for their compliance. This permission
does not authorize use by affiliates, clients, service-bureau customers, or
other third parties, and it does not permit redistribution or transfer of the
license.

## Required assent evidence

The external purchase record must show that both of these documents were
presented before purchase or expressly accepted in writing:

- `SAMPLE_LICENSE.md` version `1.0.0`, SHA-256
  `9641c0bf29ce31557b7f6bdc221b429c86456c48c9019355c3e00c5bdd6e0530`;
  and
- `TERMS_AND_ORDER_BINDING.md` supplement version `1.0.0`, with the exact
  SHA-256 recorded in `PACKAGE.json` and the archive metadata sidecar.

Retain both versions and hashes, the UTC acceptance timestamp, and the
acceptance method. Delivery of this archive does not, by itself, establish
assent. If the record lacks this evidence, obtain express written acceptance
of both documents before providing download access.

## Required private purchase record

The Seller must retain all of the following outside the customer archive:

- Seller legal name and durable contact address;
- Customer legal name, organization when applicable, and checkout email;
- payment or order identifier and payment state;
- product ID, SKU, artifact version, and package ID;
- accepted license and binding-supplement versions, both exact SHA-256 values,
  acceptance timestamp, and method;
- archive filename, byte size, SHA-256, and delivery timestamp; and
- refund, reversal, or dispute status when applicable.

Customer and transaction identifiers are intentionally omitted from the ZIP.
The private record, archive checksum sidecar, and delivered archive together
form the customer/order binding.
