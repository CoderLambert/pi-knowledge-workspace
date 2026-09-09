# Third-party corpus attribution

The P2 corpus intentionally stores only short, fixed technical snapshots needed for retrieval evaluation. It does not vendor complete upstream documentation sets.

## Vue Chinese documentation

- Upstream: `vuejs-translations/docs-zh-cn`
- Captured revision: `dda601fe33187dfd913641d58b6cefe829bf1a0d`
- Source file: `src/api/reactivity-core.md`
- Snapshot: `vue-reactivity-core-zh.md`
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), excluding upstream images
- Attribution: Copyright 2019-present Yuxi (Evan) You and Vue documentation contributors
- Adaptation: the committed snapshot is a short condensed excerpt focused on `ref()`; no images are included.

## Node.js documentation

- Upstream: `nodejs/node`
- Captured versions: `v16.7.0` and `v22.3.0`
- Source file: `doc/api/fs.md`
- Snapshots: `node-fspromises-cp-v16.7.0.md`, `node-fspromises-cp-v22.3.0.md`
- License: Node.js MIT-style license in the upstream `LICENSE`
- Attribution: Copyright Node.js contributors
- Adaptation: the committed snapshots are short condensed API excerpts preserving the version-specific `fsPromises.cp` facts needed for evaluation.

The source URI and captured version are also recorded in each `*.meta.json` corpus record.