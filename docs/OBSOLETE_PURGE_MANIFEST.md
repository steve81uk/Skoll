# Obsolete Purge Manifest

Generated: 2026-03-10
Source telemetry: `docs/DEEP_DEPENDENCY_SCAN.json`

## Scan Summary

- Scanned code modules: `127`
- Dependency edges: `181`
- Entrypoints validated: `9`
- Reachable modules from entrypoints: `123`
- Unresolved local import/link references: `0`
- Circular dependencies: `0`
- Orphan candidates (safe purge): `0`

## Structural Integrity Verdict

- Import graph integrity: `PASS`
- Cross-module linkage integrity: `PASS`
- Execution path continuity (static): `PASS`
- Circular-dependency risk: `NONE DETECTED`

## Safe Purge Candidates

No additional files are currently designated for safe purge by static dependency analysis.

## Notes

- Dynamic assets imported with query suffixes (for example `?raw`) were resolved and validated.
- Runtime worker linkages (`new Worker(new URL(..., import.meta.url))`) were included in graph extraction.
- This manifest reflects current repository state after prior orphan cleanup operations in this session.
