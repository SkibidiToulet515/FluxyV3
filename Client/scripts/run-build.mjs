/**
 * Windows-safe build entry (npm may invoke PowerShell 5, where `&&` is unsupported).
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(process.execPath, [path.join(root, 'scripts', 'syncUgsToPublic.mjs')]);
run(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build']);
