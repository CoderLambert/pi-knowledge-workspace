#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${P2_EVIDENCE_OUT_DIR:-/tmp/pi-knowledge-p2-evidence/p2-t04}"
mkdir -p "$OUT/gates"
cd "$ROOT"

exec > >(tee "$OUT/run.log") 2>&1

echo "===== P2 FTS EVIDENCE HARNESS ====="
echo "root: $ROOT"
echo "out:  $OUT"
echo "head: $(git rev-parse HEAD)"
node --version
npm --version

echo
echo "===== INSTALL REPOSITORY DEPENDENCIES ====="
npm ci

if ! node -e 'require.resolve("better-sqlite3")' >/dev/null 2>&1; then
  echo
  echo "===== INSTALL TEMPORARY NATIVE SQLITE RUNTIME ====="
  npm install --no-save --package-lock=false better-sqlite3@13.0.3
fi

node - <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(':memory:');
const sqlite = db.prepare('select sqlite_version() version').get().version;
db.exec('create virtual table __p2_fts_probe using fts5(text)');
db.prepare('insert into __p2_fts_probe(text) values (?)').run('probe token');
const row = db.prepare("select text from __p2_fts_probe where __p2_fts_probe match 'probe'").get();
console.log(JSON.stringify({ betterSqlite3: require('better-sqlite3/package.json').version, sqlite, fts5: row?.text === 'probe token' }, null, 2));
db.close();
NODE

echo
echo "===== FOCUSED CORRECTED-ANCESTRY TESTS ====="
npm test -- \
  src/knowledge/eval/goldenDataset.test.ts \
  src/knowledge/eval/representativeCorpus.test.ts \
  src/knowledge/eval/queryAnnotations.test.ts \
  src/knowledge/eval/retrievalChallengeCorpus.test.ts \
  src/knowledge/storage/searchQuery.test.ts \
  src/knowledge/storage/fts5Index.test.ts \
  src/knowledge/eval/ftsBaselineEvaluation.test.ts

echo
echo "===== REAL EXPANDED-CORPUS FTS BENCHMARK ====="
P2_EVIDENCE_OUT_DIR="$OUT" npx tsx scripts/p2-run-fts-baseline.mjs

: > "$OUT/gates/status.tsv"
if [[ "${P2_SKIP_REPO_GATES:-0}" == "1" ]]; then
  echo
  echo "===== REPOSITORY GATES SKIPPED IN THIS EXECUTION ====="
  echo "Dedicated CI run skips duplicate repository gates; the normal CI workflow owns them."
  printf 'repository-gates\tskipped\n' >> "$OUT/gates/status.tsv"
else
  echo
  echo "===== REPOSITORY GATES ====="
  run_gate() {
    local name="$1"
    shift
    echo "--- $name ---"
    set +e
    "$@" >"$OUT/gates/$name.log" 2>&1
    local rc=$?
    set -e
    printf '%s\t%s\n' "$name" "$rc" >> "$OUT/gates/status.tsv"
    tail -n 30 "$OUT/gates/$name.log" || true
    echo "[$name] exit=$rc"
  }

  run_gate typecheck npm run typecheck
  run_gate lint npm run lint
  run_gate knip npm run knip
  run_gate build npm run build
  run_gate pack-dry npm run pack:dry
  run_gate full-test npm test
  run_gate p2-t04-diff-check git diff --check origin/chore/p2-propagate-p1-t13-natural-query...origin/experiment/p2-fts-baseline-report
  run_gate p2-t04-diff-name-status git diff --name-status origin/chore/p2-propagate-p1-t13-natural-query...origin/experiment/p2-fts-baseline-report
  run_gate harness-diff-check git diff --check origin/experiment/p2-fts-baseline-report...HEAD
  run_gate harness-diff-name-status git diff --name-status origin/experiment/p2-fts-baseline-report...HEAD
fi

git status --short > "$OUT/git-status.txt"
git log -12 --oneline --decorate > "$OUT/git-log.txt"

cat > "$OUT/README.txt" <<TXT
P2 FTS evidence bundle
Generated: $(date -Iseconds)
Repository: $ROOT
HEAD: $(git rev-parse HEAD)

Primary evidence:
  fts-expanded-result.json
  fts-expanded-result.md
  run.log

Gate evidence:
  gates/status.tsv
  gates/*.log

Repository state:
  git-status.txt
  git-log.txt

A non-zero repository gate may be inherited baseline debt; classify it against the owning task before changing unrelated code. When repository gates are skipped by the dedicated evidence workflow, use the normal CI run from the same PR head for gate evidence.
TXT

echo
echo "===== EVIDENCE BUNDLE ====="
cat "$OUT/gates/status.tsv"
echo "path: $OUT"
echo "RESULT: HARNESS COMPLETE"
