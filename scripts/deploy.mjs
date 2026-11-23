// Build the site and publish dist/ to the gh-pages branch (served by GitHub Pages).
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const read = (cmd) => execSync(cmd).toString().trim();

run('npm run build');

const remote = read('git remote get-url origin');
const name = read('git config user.name');
const email = read('git config user.email');
const source = read('git rev-parse --short HEAD');

const dir = mkdtempSync(join(tmpdir(), 'mapforge-pages-'));
try {
  cpSync('dist', dir, { recursive: true });
  writeFileSync(join(dir, '.nojekyll'), '');
  run('git init -q -b gh-pages', dir);
  run('git add -A', dir);
  run(`git -c user.name="${name}" -c user.email="${email}" commit -q -m "Deploy ${source}"`, dir);
  run(`git push -f "${remote}" gh-pages`, dir);
  console.log('\nDeployed. GitHub Pages usually updates within a minute.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
