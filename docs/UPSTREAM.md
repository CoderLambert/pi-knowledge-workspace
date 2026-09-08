# Upstream Strategy

Upstream repository:

```text
https://github.com/jmfederico/pi-web.git
```

This project is a **thin product fork**, not a rewrite.

## Local Git convention

```bash
git remote -v

# expected
origin    https://github.com/CoderLambert/pi-knowledge-workspace.git
upstream  https://github.com/jmfederico/pi-web.git
```

Add upstream once after cloning:

```bash
git remote add upstream https://github.com/jmfederico/pi-web.git
git fetch upstream
```

## Sync policy

Prefer selected stable upstream releases or explicitly reviewed commits. Do not continuously merge floating `upstream/main` into production.

Typical update:

```bash
git fetch upstream

git switch main
git pull --ff-only origin main

git switch -c chore/sync-pi-web-<version>
git merge <reviewed-upstream-ref>

npm ci
npm run verify
```

Resolve conflicts by preserving upstream behavior unless a conflict is within an intentionally owned Knowledge/Learning integration seam.

## Modification discipline

### Keep upstream-first

- Machine / Fleet semantics
- Project / Workspace identity and lifecycle
- Pi session behavior
- Terminal
- Git/worktree behavior
- core file handling
- existing server/sessiond behavior unless a first-party Knowledge bridge requires a narrow integration seam

### Ours

- Knowledge navigation and UI
- Knowledge service contracts
- source/evidence/retrieval/notes features
- restricted Knowledge Ask runtime
- V1.1 Learning/Course features

## Rules for custom changes

1. Prefer adding self-contained modules over editing shared upstream modules.
2. Keep unavoidable upstream-file edits small and documented.
3. Do not deep-import private `dist/**` implementation APIs as product dependencies.
4. Do not copy upstream subsystems into custom namespaces merely to avoid a small integration change.
5. Every upstream sync runs typecheck/lint/tests and Knowledge integration E2E.
6. Record significant divergence as ADRs.

## Branch convention

Suggested:

```text
main                       product stable branch
feature/knowledge-*        first-party Knowledge work
feature/learning-*         V1.1 learning work
chore/sync-pi-web-*        upstream synchronization
spike/*                    disposable bounded experiments
```

Do not commit experiments directly to `main`.
