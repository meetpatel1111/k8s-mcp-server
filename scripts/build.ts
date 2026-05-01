#!/usr/bin/env node
/**
 * Production Build Script
 * 
 * Handles compilation, bundling, and shebang injection.
 * Usage: npm run build
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';

async function build() {
  console.log('🚀 Starting production build...');

  try {
    // 1. Run TypeScript compiler for type checking and initial transpilation
    console.log('📦 Compiling TypeScript...');
    execSync('npx tsc', { stdio: 'inherit' });

    // 2. Bundle with esbuild
    console.log('🏗️  Bundling with esbuild...');
    const entryPoint = path.join(process.cwd(), 'dist', 'index.js');
    const outfile = path.join(process.cwd(), 'dist', 'index.bundle.js');
    const finalFile = path.join(process.cwd(), 'dist', 'index.js');

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: outfile,
      minify: true,
      treeShaking: true,
      format: 'esm',
      // Externalize large dependencies to keep bundle size manageable and avoid issues with native modules
      external: [
        '@modelcontextprotocol/sdk',
        '@kubernetes/client-node',
        '@opentelemetry/api',
        '@opentelemetry/exporter-trace-otlp-grpc',
        '@opentelemetry/instrumentation',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-node',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/semantic-conventions',
        'js-yaml',
        'zod',
        'express'
      ],
    });

    // 3. Inject shebang
    console.log('📝 Injecting shebang...');
    const content = fs.readFileSync(outfile, 'utf8');
    const shebang = '#!/usr/bin/env node\n';
    fs.writeFileSync(finalFile, shebang + content);

    // 4. Cleanup temporary bundle file if it's different from finalFile
    if (outfile !== finalFile) {
      fs.unlinkSync(outfile);
    }

    // 5. Set executable permissions (cross-platform safe-ish)
    try {
      fs.chmodSync(finalFile, 0o755);
      console.log('🔓 Set executable permissions.');
    } catch (e) {
      console.warn('⚠️  Could not set executable permissions (common on Windows).');
    }

    console.log('\n✅ Build completed successfully!');
    console.log(`📂 Output: ${finalFile}`);
  } catch (error) {
    console.error('\n❌ Build failed:');
    console.error(error);
    process.exit(1);
  }
}

build();
