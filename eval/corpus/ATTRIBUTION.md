# Third-party corpus attribution

The P2 corpus intentionally stores only short, fixed technical snapshots needed for retrieval evaluation. It does not vendor complete upstream documentation sets.

## Vue Chinese documentation

- Upstream: `vuejs-translations/docs-zh-cn`
- Captured revision: `dda601fe33187dfd913641d58b6cefe829bf1a0d`
- Source file: `src/api/reactivity-core.md`
- Snapshots: `vue-reactivity-core-zh.md`, `challenge-vue-reactivity-neighbors.md`
- License: Creative Commons Attribution 4.0 International (CC BY 4.0), excluding upstream images
- Attribution: Copyright 2019-present Yuxi (Evan) You and Vue documentation contributors
- Adaptation: the committed snapshots are short condensed/adapted excerpts. The original snapshot focuses on `ref()`; the challenge snapshot deliberately selects neighboring reactivity topics and omits target `ref()` passages so it can act as development-only retrieval pressure without becoming new Golden Evidence.

## Node.js documentation

- Upstream: `nodejs/node`
- Captured versions: `v16.7.0` and `v22.3.0`
- Source file: `doc/api/fs.md`
- Snapshots: `node-fspromises-cp-v16.7.0.md`, `node-fspromises-cp-v22.3.0.md`, `challenge-node-fspromises-neighbors-a.md`, `challenge-node-fspromises-neighbors-b.md`
- License: Node.js MIT-style license in the upstream `LICENSE`
- Attribution: Copyright Node.js contributors
- Adaptation: the original snapshots preserve version-specific `fsPromises.cp` facts needed for evaluation. The challenge snapshots condense neighboring `fs/promises` APIs at v22.3.0 and deliberately omit `fsPromises.cp` target passages while retaining overlapping vocabulary such as options, Promise, recursive and force.

The source URI and captured version are also recorded in each `*.meta.json` corpus record. Challenge artifacts are development-only hard-negative material; they do not add or modify Golden Evidence labels.
