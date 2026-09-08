# P1-T06 — Safe Workspace file reader verification

Status: **OPEN / PARTIAL**

## Automated verification

```bash
npm test -- src/knowledge/storage/workspaceFileReader.test.ts
npm run typecheck
npm run lint
npm run knip
npm run build
npm run pack:dry
npm test
git diff --check origin/feat/p1-source-version-domain...HEAD
git diff --name-status origin/feat/p1-source-version-domain...HEAD
```

Expected focused result: 8/8 tests pass. Do not modify unrelated inherited baseline failures to obtain green.

## Filesystem/security acceptance

Using a real temporary Workspace on the target Linux filesystem:

1. capture an MD/TXT file containing Chinese/emoji and confirm returned bytes and SHA-256 are exact;
2. attempt `../outside`, an absolute path and a symlink escaping the Workspace; all must fail before bytes are returned;
3. verify a symlink to a target still inside the Workspace is permitted and the canonical target is captured;
4. attempt `.env`, `.env.local`, `.ssh/config`, `id_rsa`, `*.pem` and `*.key`; all must fail with `SENSITIVE_FILE`;
5. create a file above the configured limit and confirm `FILE_TOO_LARGE` without a returned capture;
6. replace/retarget the selected path during capture and confirm `FILE_CHANGED_DURING_CAPTURE`;
7. select a directory/FIFO/non-regular path and confirm rejection;
8. confirm successful capture exposes no write authority and does not itself create a blob, SourceVersion, job or parser artifact.

## Expected PASS evidence

- focused tests: 8/8 PASS;
- typecheck/lint/knip/build/pack gates PASS;
- full suite introduces no P1-T06-attributable failure;
- direct-base diff is task-only;
- target filesystem evidence demonstrates traversal/symlink/sensitive-file/size/race defenses and exact-byte hashing.

P1-T06 remains PARTIAL until this evidence is recorded. P1-T07 may proceed using only a successful captured-byte result under the autonomous execution policy.
