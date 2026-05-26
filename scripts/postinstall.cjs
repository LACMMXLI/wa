const { existsSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

if (!existsSync('dashboard')) {
  process.exit(0);
}

if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
  execFileSync(process.execPath, [process.env.npm_execpath, '--prefix', 'dashboard', 'install'], {
    stdio: 'inherit',
  });
} else {
  execFileSync('npm', ['--prefix', 'dashboard', 'install'], {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
}
