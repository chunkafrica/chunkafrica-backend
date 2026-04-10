const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const generatedClientDir = path.join(rootDir, 'node_modules', '.prisma', 'client');
const installedClientDir = path.join(rootDir, 'node_modules', '@prisma', 'client');

const generatedFiles = [
  'client.d.ts',
  'client.js',
  'default.d.ts',
  'default.js',
  'edge.d.ts',
  'edge.js',
  'index-browser.js',
  'index.d.ts',
  'index.js',
  'schema.prisma',
  'wasm-edge-light-loader.mjs',
  'wasm-worker-loader.mjs',
  'wasm.d.ts',
  'wasm.js',
];

function syncGeneratedClient() {
  if (!fs.existsSync(generatedClientDir) || !fs.existsSync(installedClientDir)) {
    throw new Error('Prisma client directories were not found. Run `prisma generate` first.');
  }

  for (const fileName of generatedFiles) {
    const sourcePath = path.join(generatedClientDir, fileName);
    const targetPath = path.join(installedClientDir, fileName);

    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

syncGeneratedClient();
