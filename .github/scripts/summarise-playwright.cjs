const fs = require('fs');
const f = 'playwright-report/results.json';
if (!fs.existsSync(f)) {
  const msg = '## Playwright failures\n\nNo JSON report was produced (the run failed before tests started).\n';
  fs.writeFileSync('pw-failures.md', msg);
  console.log(msg);
  process.exit(0);
}
const r = JSON.parse(fs.readFileSync(f, 'utf8'));
const out = [];
const walk = (s) => {
  for (const sp of s.suites ?? []) walk(sp);
  for (const t of s.specs ?? []) {
    if (t.ok) continue;
    for (const x of t.tests ?? []) for (const res of x.results ?? []) {
      const e = res.error ?? {};
      out.push('### ' + t.title + '\n\n```\n' + String((e.message || '') + '\n' + (e.stack || '')).slice(0, 2500) + '\n```');
    }
  }
};
for (const s of r.suites ?? []) walk(s);
fs.writeFileSync('pw-failures.md', '## Playwright failures\n\n' + (out.join('\n\n') || 'none') + '\n');
console.log(fs.readFileSync('pw-failures.md', 'utf8'));
