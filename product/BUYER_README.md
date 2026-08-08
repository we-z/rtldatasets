# SoC Design + Verification RLVR Diagnostic Sample: 5 Tasks

- Product ID: `soc-dv-rlvr-diagnostic-sample-5-task`
- SKU: `SOC-DV-RLVR-DIAG-5-V1`
- Artifact version: `2.0.0`
- Sample ID: `soc-dv-gpt-5.6-luna-shakedown-v1`

This is a compact, integrity-verified diagnostic sample spanning memory,
DMA, storage, and peripheral controller work. It contains five RTL design
tasks built around SystemVerilog, Python, and Icarus Verilog: a 4-bank
SDRAM-class command scheduler, a 4-way write-back cache controller, a
four-channel scatter-gather DMA engine, a clock-divided SD/MMC-style host
engine, and a four-die NAND-style flash controller.

Every task's command encodings, timing rules, and checksum algebra are
synthetic — invented for this pack and specified only in each task's
`README.md` — so no rule can be inferred from a real-world datasheet or
standard, and no rule can be inferred from prior familiarity with the
device class.

## Included

- Five public task bundles with cycle-exact specifications, editable
  starter files, and public smoke tests.
- Task metadata (`task.json`) documenting the interface, limits, and
  source policy enforced by each hidden grader.
- The shared grader-contract documentation (`TB_PROTOCOL.md`,
  `REWARD_CONTRACT.md`) describing the counter-stream protocol and the
  reward formula every hidden grader implements.
- Real evaluation results from five independent fresh attempts per task by
  a current frontier coding model, including per-family component scores
  (`RESULTS.md`, `results/RESULTS.json`).
- `MANIFEST.sha256`, covering every other regular file in this archive.

## Not included

- Private graders, hidden testbenches, reference/golden implementations,
  or completed model solutions.
- Raw agent messages, candidate diffs, provider thread or receipt IDs,
  credentials, or private toolchain images.
- A turnkey hidden-reward runtime. The hidden reward cannot be reproduced
  from this download alone.

This is a diagnostic sample, not a production benchmark or a guarantee of
model performance. The included results must not be presented as
production benchmark results.

## Originality

All five task contracts, starter files, public tests, and reference
solutions are original works authored for this product. None of them
derive from, or embed, third-party or open-source source code.

## Integrity verification

From the extracted top-level directory, run `shasum -a 256 -c
MANIFEST.sha256` (or `sha256sum -c MANIFEST.sha256` on Linux). The manifest
covers every other regular file in the archive using the standard
`<sha256><two spaces><relative POSIX path>` format that `shasum`/`sha256sum`
produce and check directly.

The archive-level SHA-256 is published outside the archive in the purchase
record and download response.

## Public checks

Each task README documents its public smoke test. The public workflow
uses only Icarus Verilog 12 (`iverilog`, `vvp`) and Python 3 — no
Makefiles, cocotb, Verilator, or Yosys are required. Pinned production
environments and private verification infrastructure are not part of this
download.

## Support

Email `root@puul.ai` with the checkout email address, artifact version, and
a description of the issue.
