/**
 * Bundle src/kiri/run/cli.js into a single CJS file for pkg packaging.
 *
 * The banner injects KIRI_ROOT so the binary can locate its built-in default
 * configs (src/cli/*.json) regardless of where the executable is installed.
 */

import { build } from 'esbuild';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

// jspoly.js is a bundled polygon library that internally require()s voronoi
// sub-modules via relative paths that don't exist as standalone files —
// they were webpack chunks in the original build. Stub them out; voronoi is
// unused in FDM slicing.
const jspolyStubs = {
    name: 'jspoly-internal-stubs',
    setup(build) {
        const internal = [
            './constants', './voronoi_structures', './voronoi_ctypes',
            '../thirdparty/jsbn', './collections', './voronoi_predicates',
            './voronoi_builder', './point_data', './segment_data',
            './cppgen', './voronoi_diagram', './voronoi',
        ];
        for (const name of internal) {
            const re = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
            build.onResolve({ filter: re }, args => {
                if (args.importer.includes('jspoly')) {
                    return { path: name, namespace: 'jspoly-stub' };
                }
            });
        }
        build.onLoad({ filter: /.*/, namespace: 'jspoly-stub' }, () => ({
            contents: 'module.exports = {};',
            loader: 'js',
        }));
    },
};

await build({
    entryPoints: [path.join(ROOT, 'src/kiri/run/cli.js')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(ROOT, 'dist/bundle.cjs'),
    absWorkingDir: ROOT,
    plugins: [jspolyStubs],
    // In CJS output, import.meta.url is undefined — polyfill it with __filename.
    // KIRI_ROOT is set to one level above the bundle so built-in configs resolve
    // correctly in both dev (dist/) and pkg snapshot (/snapshot/kiri-moto/dist/).
    banner: {
        js: `const __import_meta_url = require('url').pathToFileURL(__filename).href;
if (!process.env.KIRI_ROOT) {
  process.env.KIRI_ROOT = require('path').resolve(__dirname, '..');
}`,
    },
    define: {
        'import.meta.url': '__import_meta_url',
    },
});

console.log('bundled → dist/bundle.cjs');
