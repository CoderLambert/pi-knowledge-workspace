# P2-T07 — sqlite-vec deployment spike

Status: **UNRUN / PARTIAL**

`sqlite-vec` remains an optional deployment experiment. This report must not be interpreted as an adoption decision.

## Runtime record

| Field | Result |
| --- | --- |
| target OS / arch | UNRUN |
| Node version | UNRUN |
| better-sqlite3 version | UNRUN |
| sqlite-vec package/source | UNRUN |
| extension absolute path | UNRUN |
| `vec_version()` | UNRUN |
| extension load | UNRUN |
| process restart + reload | UNRUN |
| scoped KNN correctness | UNRUN |
| concurrent readers/writer smoke | UNRUN |
| query p50 / p95 / max | UNRUN |
| peak RSS | UNRUN |
| SQLite DB bytes | UNRUN |
| vec index/table bytes | UNRUN |

## Probe contract

The repository probe loads an explicitly resolved extension path and records runtime `vec_version()` instead of baking a pre-v1 sqlite-vec release into architecture.

It creates a three-dimensional cosine `vec0` table with a metadata `scope` column, inserts vectors across two scopes, then runs:

```sql
SELECT rowid, distance
FROM vec_p2_probe
WHERE embedding MATCH ?
  AND scope = ?
  AND k = ?
ORDER BY distance, rowid
```

The result must contain only rows from the requested scope. This proves the deployment's filtering semantics needed before Top-K rather than performing an application-side global Top-K/filter pass.

## Adoption stop conditions

Do not adopt sqlite-vec if any mandatory condition fails:

- native extension cannot load reproducibly on the supported Omarchy/Linux target;
- restart requires brittle/manual state not acceptable for packaging;
- scoped filtering cannot be proven inside the KNN query;
- concurrency behavior is unsafe for the expected local workload;
- p95/memory/index-size cost is materially worse than the brute-force evaluation path for the target corpus size;
- packaging requires unsupported or unmaintainable binary handling.

If the spike fails, P2 dense quality may still be evaluated with the P2-T06 in-memory index; vector-storage adoption is optional.
