#!/usr/bin/env node
/**
 * Production Build Pipeline for k8s-helm-mcp
 * 
 * Optimized for minimal bundle size (~460KB) and high performance.
 * Features: Type checking, esbuild bundling, automated externals, and shebang injection.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';

async function runBuild() {
  const startTime = Date.now();
  console.log('🚀 Starting optimized build pipeline...');

  try {
    // 1. Reset dist directory
    if (fs.existsSync('./dist')) {
      console.log('🧹 Cleaning dist...');
      fs.rmSync('./dist', { recursive: true, force: true });
    }
    fs.mkdirSync('./dist');

    // 2. Type Checking (NoEmit)
    console.log('🔍 Type checking...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });

    // 3. esbuild Bundling
    console.log('🏗️  Bundling with esbuild...');
    
    // Dynamically externalize all dependencies from package.json
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const external = Object.keys(pkg.dependencies || {});
    
    const entryFile = path.join(process.cwd(), 'src', 'index.ts');
    const bundleFile = path.join(process.cwd(), 'dist', 'index.bundle.js');
    const finalFile = path.join(process.cwd(), 'dist', 'index.js');

    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: bundleFile,
      minify: true,
      treeShaking: true,
      format: 'esm',
      sourcemap: false, // Disabled to keep production artifact clean
      external: external,
      banner: {
        js: '#!/usr/bin/env node',
      },
    });

    // 4. Finalize
    fs.renameSync(bundleFile, finalFile);

    // 5. Permissions
    try {
      fs.chmodSync(finalFile, 0o755);
      console.log('🔓 Permissions set.');
    } catch (e) {
      console.log('ℹ️  Skipped chmod (Windows).');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = fs.statSync(finalFile);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log(`\n✅ Build successful in ${duration}s!`);
    console.log(`📊 Bundle Size: ${sizeKB} KB`);
    console.log(`📂 Location: ${finalFile}`);

  } catch (error) {
    console.error('\n💥 Build failed:');
    console.error(error);
    process.exit(1);
  }
}

runBuild();
