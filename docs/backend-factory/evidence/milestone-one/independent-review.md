# Independent review — Milestone One (preview of post-CI review posture)

Run ID: `run-2026-09-05-107b3c58` · Constraint honored: **no self-certification**
— this document records the review *protocol* and pre-review findings; the
actual independent review pass runs after first CI signal, followed by a
human review on the Draft PR.

## Review protocol (what "independent" means here)

1. **CI as first reviewer**: compile + 880+ tests (unit + integration), rustfmt,
   clippy `-D warnings`, frontend suite, mission validator, and the
   integrity-verified release probe must all pass before any claim stands.
2. **Cross-surface consistency review**: every number asserted in docs
   (counts, digests, dates, row states) re-derived from source with a script
   before finalizing (already partially executed — see Journal).
3. **Adversarial readback**: pick 3 claims at random per doc, attempt to
   falsify each against primary sources.
4. **Human review hold**: PR stays Draft; never marked Ready for Review.

## Pre-review findings (integrity self-check executed during authoring)

- **Consistency check #1** (capability matrix vs `lifecycle.rs` rows): executed
  manually; 34 required + 3 permanently-denied rows match between docs and
  code; `Support` states compared against `capability-matrix.md` — no drift
  found after the F-1 Windows-ARM64 correction.
- **Consistency check #2** (digest strings everywhere): the ten official
  digests appear exactly twice each (fixture + `verification.rs` table +
  evidence doc table); byte-compared in the integration test
  (`PINNED_CHECKSUMS_FILE_SHA256` pins the fixture's own sha256).
- **Falsification attempt A**: could the recorded "default branch = master,
  recorded head `f11adb59`" be stale? Repo metadata re-fetched at authoring
  time — branch `master`, latest release tag `v0.81.7`, most recent release
  date 2026-09-04 — consistent.
- **Falsification attempt B**: does `@1jehuang/jcode-sdk` on npm contradict
  the "repo SDK is 1.2.0" claim? Registry shows 1.1.0 (**registry lags
  repo**) — recorded; the boundary consumes **neither** this milestone, so no
  false premise is load-bearing.
- **Falsification attempt C**: is "smol to countries" (visible README typo)
  evidence of fabricated upstream content? No — the typo reproduces verbatim
  in the raw API payload (`"Why smol to countries?"` feature bullet) —
  recorded as authenticity evidence, quoted with care.

## Known limitations of this review round

- **No local Rust compile**: this sandbox has no toolchain and none is
  installable (network-blocked registries) — compile correctness is delegated
  to Windows CI, with ≤5 bounded CI remediations per the failure budget.
- **Fixture honesty**: 12 of 18 protocol fixtures are `synthetic` (marked in
  PROVENANCE.md; never mislabeled as captured). The SHA256SUMS record and
  version fixtures are exact/derived - only the protocol fixtures are
  synthetic, and justify that with the absence of any public harness-API trace
  archive (checked: upstream ships no recorded wire sessions).
- **Local runtime boundary**: local embeddings default-off is a *policy*
  backed by tests on the launch-policy surface, not a runtime code path yet
  (M2 own the spawn).

## Post-CI review actions (scripted before reporting)

1. Confirm the `jcode-release-probe` job's three-way digest agreement and
   `version --json` stdout contract on `windows-latest`; paste job URL.
2. If it fails: classify per `jcode/lifecycle.rs::classify_exit` diagnostics
   from stderr + job log; remediate within the ≤5 CI budget or mark the probe
   as blocked with a recorded classification — **never fake a pass**.
3. Re-run the mission validator; confirm 0 issues.
4. Wait for human review; **Milestone One is not marked complete in factory
   state**; this document stays open until the human verdict lands.
