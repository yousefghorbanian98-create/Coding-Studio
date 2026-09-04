import { resolve } from 'node:path';
import { validateFactory, VALIDATOR_VERSION } from './validator.mjs';

function parseArgs(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      root = resolve(argv[i + 1] ?? process.cwd());
      i += 1;
    } else if (argv[i] === '--version') {
      console.log(`validate-mission ${VALIDATOR_VERSION}`);
      process.exit(0);
    } else if (argv[i] === '--help') {
      console.log('Usage: npm run validate:mission [-- --root <dir>]');
      process.exit(0);
    }
  }
  return root;
}

const root = parseArgs(process.argv.slice(2));
const result = validateFactory(root);

if (!result.ok) {
  console.error(`Mission validation FAILED (${result.issues.length} issue(s))`);
  for (const item of result.issues) {
    const file = item.file ? ` ${item.file}` : '';
    console.error(`  [${item.code}]${file} ${item.message}`);
  }
  process.exit(1);
}

console.log(`Mission validation PASSED (${result.issues.length} issues, validator ${VALIDATOR_VERSION})`);
