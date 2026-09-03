const fs = require('fs');

// Distinguishes three very different situations that previously all rendered
// as "No JSON report was produced", which wrongly implicated Playwright when
// an earlier step (typically Vitest) was the actual failure.
const REPORT = 'playwright-report/results.json';
const CONSOLE = 'pw-output.txt';

function emit(body) {
  const md = '## Playwright\n\n' + body + '\n';
  fs.writeFileSync('pw-failures.md', md);
  console.log(md);
}

// The step sets this only when it actually ran.
if (!fs.existsSync(CONSOLE) && !fs.existsSync(REPORT)) {
  emit(
    'Skipped. The Playwright step never ran because an earlier step in the ' +
      'job failed. Fix the earlier failure first — this is not evidence of ' +
      'an end-to-end problem.',
  );
  process.exit(0);
}

if (!fs.existsSync(REPORT)) {
  const tail = fs.existsSync(CONSOLE)
    ? fs.readFileSync(CONSOLE, 'utf8').split('\n').slice(-200).join('\n')
    : '(no console output captured)';
  emit(
    'Failed before producing a report. Playwright started but exited before ' +
      'writing `results.json`, so no per-test result exists. Console output ' +
      'follows.\n\n```\n' +
      tail +
      '\n```',
  );
  process.exit(0);
}

const r = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const out = [];
const walk = (s) => {
  for (const sp of s.suites ?? []) walk(sp);
  for (const t of s.specs ?? []) {
    if (t.ok) continue;
    for (const x of t.tests ?? [])
      for (const res of x.results ?? []) {
        const e = res.error ?? {};
        out.push(
          '### ' +
            t.title +
            '\n\n```\n' +
            String((e.message || '') + '\n' + (e.stack || '')).slice(0, 2500) +
            '\n```',
        );
      }
  }
};
for (const s of r.suites ?? []) walk(s);

emit(
  out.length > 0
    ? 'Ran, and the following tests failed.\n\n' + out.join('\n\n')
    : 'Ran and reported no failing test. If the step still failed, the cause ' +
        'is outside the test results (for example the web server or a global ' +
        'setup hook).',
);
