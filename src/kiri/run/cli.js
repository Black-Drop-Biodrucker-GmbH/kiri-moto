#!/usr/bin/env node
/**
 * Kiri:Moto headless CLI slicer.
 *
 * Usage: node src/kiri/run/cli.js [options] <model.stl>
 *
 *   --help                  show this message
 *   --verbose               enable verbose logging
 *   --mode=FDM|CAM|LASER|SLA   slicing mode (default: from device file)
 *   --device=<file.json>    device profile (JSON)
 *   --process=<file.json>   process/settings profile (JSON)
 *   --controller=<file.json>  controller settings (JSON)
 *   --tools=<file.json>     CAM tool library (JSON)
 *   --output=<file>         write gcode to file (default: stdout)
 *   --position=x,y,z        move model to absolute position
 *   --move=x,y,z            translate model by x,y,z mm
 *   --scale=x,y,z           scale model in x,y,z
 *   --rotate=x,y,z          rotate model by x,y,z radians
 */

import './setup-node.js';  // must be first — defines globalThis.self before kiri modules load
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function resolve(p) {
    if (!p) return undefined;
    return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

function readJSON(file) {
    // some config files use trailing commas — strip them before parsing
    const raw = fs.readFileSync(file, 'utf8').replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(raw);
}

const args = process.argv.slice(2);
const opts = {
    output:     '-',
    device:     'src/cli/kiri-fdm-device.json',
    process:    'src/cli/kiri-fdm-process.json',
    controller: 'src/cli/kiri-controller.json',
    tools:      'src/cli/kiri-cam-tools.json',
    model:      null,
    verbose:    false,
    help:       false,
};

for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (raw.startsWith('--')) {
        const eq = raw.indexOf('=');
        if (eq > 0) {
            opts[raw.slice(2, eq)] = raw.slice(eq + 1);
        } else {
            opts[raw.slice(2)] = true;
        }
    } else if (raw.startsWith('-') && i + 1 < args.length) {
        opts[raw.slice(1)] = args[++i];
    } else {
        opts.model = raw;
    }
}

if (opts.help) {
    // print the usage block from the top comment
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const m = src.match(/\/\*\*([\s\S]*?)\*\//);
    if (m) console.log(m[1].replace(/^ \*/gm, '').trim());
    process.exit(0);
}

if (!opts.model) {
    console.error('error: no model file specified (use --model=<file> or pass as last argument)');
    process.exit(1);
}

if (opts.verbose) {
    console.log('opts:', opts);
}

const device     = readJSON(resolve(opts.device));
const process_   = readJSON(resolve(opts.process));
const controller = readJSON(resolve(opts.controller));
const tools      = readJSON(resolve(opts.tools));
const mode       = opts.mode || device.mode || 'FDM';
const modelPath  = resolve(opts.model);
const modelBuf   = fs.readFileSync(modelPath);
// fs.readFileSync returns a Buffer whose .buffer is a shared pool — slice out just the file bytes
const modelData  = modelBuf.buffer.slice(modelBuf.byteOffset, modelBuf.byteOffset + modelBuf.byteLength);

const { newEngine } = await import('./engine.js');
const engine = await newEngine();

if (opts.verbose) {
    engine.setListener(msg => console.log('engine:', JSON.stringify(msg)));
}

function vec3(str) {
    return str.split(',').map(v => parseFloat(v || 0));
}

await engine.parse(modelData);

if (opts.position) {
    const [x, y, z] = vec3(opts.position);
    engine.moveTo(x, y, z);
}
if (opts.move) {
    const [x, y, z] = vec3(opts.move);
    engine.move(x, y, z);
}
if (opts.scale) {
    const [x, y, z] = vec3(opts.scale);
    engine.scale(x, y, z);
}
if (opts.rotate) {
    const [x, y, z] = vec3(opts.rotate);
    engine.rotate(x, y, z);
}

engine.setDevice(device);
engine.setProcess(process_);
engine.setController(controller);
engine.setMode(mode);

if (mode === 'CAM') engine.setTools(tools);

await engine.slice();
await engine.prepare();
const gcode = await engine.export();

if (opts.output === '-') {
    process.stdout.write(gcode);
} else {
    fs.writeFileSync(resolve(opts.output), gcode);
    if (opts.verbose) console.log('wrote:', opts.output);
}
