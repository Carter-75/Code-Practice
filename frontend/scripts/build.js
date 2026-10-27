// Production build helper.
//
// The API service contains __PRODUCTION__ / __PROD_BACKEND_URL__ placeholders
// that are substituted from the environment at build time. The old inline
// build script rewrote src/app/services/api.service.ts in place and never
// restored it, leaving the working tree dirty (and the placeholders destroyed)
// after every build. This script backs the file up, substitutes, builds, and
// always restores the original source, then flattens the Angular output
// folder the way the previous build did.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const apiService = path.join(root, 'src', 'app', 'services', 'api.service.ts');
const original = fs.readFileSync(apiService, 'utf8');

function restore() {
  fs.writeFileSync(apiService, original);
}

try {
  let c = original;
  c = c.split('__PRODUCTION__').join(process.env.PRODUCTION || 'false');
  c = c.split('__PROD_BACKEND_URL__').join(process.env.PROD_BACKEND_URL || '');
  c = c.split('__PROD_FRONTEND_URL__').join(process.env.PROD_FRONTEND_URL || '');
  fs.writeFileSync(apiService, c);

  const ng = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(ng, ['ng', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return;
  }

  const src = path.join(root, 'dist', 'frontend', 'browser');
  const dest = path.join(root, 'dist', 'frontend');
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true });
  }
} finally {
  restore();
}
