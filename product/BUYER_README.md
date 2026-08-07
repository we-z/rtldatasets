# SoC Design + Verification RLVR Diagnostic Sample: 5 Tasks

- Product ID: `soc-dv-rlvr-diagnostic-sample-5-task`
- SKU: `SOC-DV-RLVR-DIAG-5-V1`
- Artifact version: `1.0.2`
- Sample ID: `soc-dv-gpt-5.3-codex-spark-shakedown-v1`

This is a compact, integrity-verified diagnostic sample spanning UART, memory,
and RV32 CPU work. It contains three RTL design/repair tasks and two
verification-authoring tasks built around Verilog/SystemVerilog, Python,
cocotb, Icarus Verilog, Verilator, and Yosys.

## Included

- Five public task bundles with specifications, editable starter files,
  Makefiles, and public tests.
- Task metadata, locked reward contracts, environment requirements,
  provenance, and admission summaries.
- Protocol and trajectory schemas, aggregate evaluation results, and sanitized
  per-snapshot reward/component trajectories from one fresh attempt per task.
- `MANIFEST.sha256`, covering every other regular file in this archive.
- Per-task license files and a consolidated third-party notice.

## Not included

- Private graders, hidden tests or mutation banks, gold solutions, or completed
  model solutions.
- Raw agent messages, candidate diffs, provider thread or receipt IDs,
  credentials, or private toolchain images.
- A turnkey hidden-reward runtime. The hidden reward cannot be reproduced from
  this download alone.

This is a diagnostic sample, not a production benchmark or a guarantee of model
performance. The included results must not be presented as production benchmark
results.

## Integrity verification

From the extracted top-level directory, verify the file manifest with a script
that reads each row as:

```text
<sha256><two spaces><decimal bytes><two spaces><relative POSIX path>
```

The archive-level SHA-256 is published outside the archive in the purchase
record and download response.

## Public checks

Each task README documents its public check. Depending on the task, the public
workflow uses GNU Make with Icarus Verilog, Verilator, Yosys, Python, or cocotb.
Pinned production environments and private verification infrastructure are not
part of this download.

## Support

Email `root@puul.ai` with the checkout email address, artifact version, and a
description of the issue.
