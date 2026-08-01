# Third-party notices

The purchase price covers task design and hardening, curation, packaging,
metadata, and evaluation evidence. It does not grant exclusive ownership of
third-party material or convert open-source components into proprietary
software. The license file inside each task directory remains authoritative.

| Task | Origin | Revision / basis | License |
| --- | --- | --- | --- |
| `uart.tx_ready_valid.v1` | `Darksecond/TimeWave` | UART transmitter commit `18344d799fd83868bbff43667e8f210e4275ab94`; adapted into an intentionally incomplete starter | MIT |
| `uart.tx_protocol_dv.v1` | Fresh verification-authoring task around the `Darksecond/TimeWave` UART contract | Contract source commit `18344d799fd83868bbff43667e8f210e4275ab94` | MIT |
| `memory.axi4_ram_repair.v1` | `CoreyChen922/verilog-axi`, upstream `alexforencich/verilog-axi` | Reduced from `66b20c171b50ec891d6f17998ec3ea9246c18cd8`; reference repair `5f302d81063fef7510456692553c00f5a8966f24` | MIT |
| `memory.dffram_dv_generator.v1` | `AUCOHL/DFFRAM` | Reduced and behaviorally hardened adaptation of PR 46 (`a374828d72a7c9decaf3c258`) | Apache-2.0 |
| `cpu.rv32_divider.v1` | Original synthetic benchmark fixture authored for this task | Authored July 21, 2026 | MIT |

Four task bundles are distributed under MIT terms and one under Apache License
2.0. Applicable copyright, attribution, modification, and license notices are
preserved in the corresponding task directories, including each task's
`LICENSE`, `README.md`, `ASSETS.json`, and `task.json`.
