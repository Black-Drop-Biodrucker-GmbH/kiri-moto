/**
 * Headless slicing engine — no GUI/browser dependencies.
 * Replaces the browser engine.js that imported from kiri/app/.
 */

import '../../add/array.js';
import '../../add/class.js';
import '../../add/three.js';

import '../core/codec.js';  // must load before widget.js to resolve circular dep
import { newWidget } from '../core/widget.js';
import { STL } from '../../load/stl.js';
import { client, startWorker } from './client-headless.js';

class Engine {
    constructor() {
        this.widget = newWidget();
        this.settings = {
            mode:       'FDM',
            controller: {},
            render:     false,
            filter:     { FDM: 'internal' },
            device:     {},
            process:    {},
            widget:     { [this.widget.id]: {} },
            time:       Date.now(),
        };
        this.listener = () => {};
    }

    setListener(listener) {
        this.listener = listener;
        return this;
    }

    setRender(bool) {
        this.settings.render = bool;
        return this;
    }

    workspace() {
        return this.settings;
    }

    clear() {
        this.widget = newWidget();
        this.settings.widget = { [this.widget.id]: {} };
        return this;
    }

    /**
     * Parse raw binary buffer (STL, 3MF, etc.) into the engine widget.
     * @param {ArrayBuffer} data
     */
    parse(data) {
        return new Promise((resolve, reject) => {
            try {
                const vertices = new STL().parse(data);
                this.listener({ parsed: data, vertices });
                this.widget.loadVertices(vertices).center();
                this.setTopOffset(0);
                resolve(this);
            } catch (error) {
                reject(error);
            }
        });
    }

    setMode(mode) {
        const lmode = mode.toLowerCase();
        Object.assign(this.settings, {
            mode,
            controller: {},
            render:     false,
            filter:     { [mode]: 'internal' },
        });
        return this;
    }

    setDevice(device) {
        Object.assign(this.settings.device, device);
        return this;
    }

    setProcess(process) {
        Object.assign(this.settings.process, process);
        return this;
    }

    setController(controller) {
        Object.assign(this.settings.controller, controller);
        return this;
    }

    setTools(tools) {
        this.settings.tools = tools;
        return this;
    }

    setStock(stock) {
        const { settings } = this;
        const { process } = settings;
        settings.stock = stock;
        process.camStockX = stock.x;
        process.camStockY = stock.y;
        process.camStockZ = stock.z;
        settings.stock.center = { x: stock.x / 2, y: stock.y / 2, z: stock.z / 2 };
        return this;
    }

    setTopOffset(offset = 0) {
        this.topOffset = offset;
        const wbb = this.widget.getBoundingBox();
        this.widget.setTopZ(wbb.max.z - offset);
        return this;
    }

    setOrigin(x, y, z) {
        this.origin = { x, y, z };
        this.settings.origin = this.origin;
        return this;
    }

    moveTo(x, y, z) {
        this.widget.move(x, y, z, true);
        return this;
    }

    move(x, y, z) {
        this.widget.move(x, y, z);
        return this;
    }

    scale(x, y, z) {
        this.widget.scale(x, y, z);
        return this;
    }

    rotate(x, y, z) {
        this.widget.rotate(x, y, z);
        return this;
    }

    slice() {
        return new Promise((resolve, reject) => {
            client.clear();
            client.sync([this.widget]);
            client.rotate(this.settings);
            client.slicePre(this.settings, () => {});
            client.slice(this.settings, this.widget, msg => {
                this.listener({ slice: msg });
                if (msg.error) reject(msg.error);
                if (msg.done) {
                    resolve(this);
                    client.slicePost(this.settings, () => {});
                }
            });
        });
    }

    prepare() {
        return new Promise((resolve, reject) => {
            client.prepare(
                this.settings,
                (progress, message) => {
                    this.listener({ prepare: { progress, message } });
                },
                (output, maxSpeed, minSpeed) => {
                    this.listener({ prepare: { done: true } });
                    resolve(this);
                },
            );
        });
    }

    export() {
        return new Promise((resolve, reject) => {
            const output = [];
            client.export(
                this.settings,
                segment => {
                    if (typeof segment === 'string') {
                        this.listener({ export: { segment } });
                        output.push(segment);
                    }
                },
                (done, error) => {
                    if (error) return reject(error);
                    this.listener({ export: { done } });
                    resolve(output.join('\r\n'));
                },
            );
        });
    }
}

export async function newEngine() {
    await startWorker();
    return new Engine();
}

export { Engine };
