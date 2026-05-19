/**
 * Headless client — same interface as app/workers.js `client` but routes
 * messages directly to the worker dispatch handler (no browser Worker thread).
 *
 * Setup order matters:
 *   1. Set globalThis.postMessage so worker dispatch.send() can reply
 *   2. Import worker.js — it sets globalThis.onmessage = dispatch.onmessage
 *   3. Engine calls client methods which call workerSend()
 *   4. workerSend() calls globalThis.onmessage({data:msg}) via setImmediate
 *   5. dispatch processes the task and calls globalThis.postMessage({seq,done,data})
 *   6. Our postMessage handler routes to the pending callback
 */

let dispatchOnmessage = null;
let pendingCallbacks = {};
let seqid = 1;
let syncd = {};

// route worker responses back to callers
globalThis.postMessage = (msg) => {
    const { seq, done, data } = msg;
    const record = pendingCallbacks[seq];
    if (record) {
        record.fn(data, msg);
        if (done) delete pendingCallbacks[seq];
    }
};

// initialise the worker dispatch (call once before using the client)
export async function startWorker() {
    await import('./worker.js');
    dispatchOnmessage = globalThis.onmessage;
}

function workerSend(task, data, callback, transfer) {
    const seq = seqid++;
    if (callback) pendingCallbacks[seq] = { fn: callback };
    const msg = { seq, task, time: Date.now(), data };
    setImmediate(() => {
        if (dispatchOnmessage) dispatchOnmessage({ data: msg });
    });
}

function noop() {}

export const client = {
    clear() {
        syncd = {};
        workerSend('clear', {}, noop);
    },

    sync(widgets) {
        for (const widget of widgets.filter(w => w.modified || !syncd[w.id])) {
            syncd[widget.id] = true;
            const vertices = widget.getGeoVertices();
            const pos = widget.mesh ? widget.mesh.position : { x: 0, y: 0, z: 0 };
            workerSend('sync', {
                id:       widget.id,
                anno:     widget.anno || {},
                group:    widget.group.id,
                meta:     widget.meta,
                position: pos,
                track:    widget.track,
                vertices,
            }, () => { widget.modified = false; }, vertices ? [vertices.buffer] : []);
        }
    },

    rotate(settings, callback) {
        workerSend('rotate', { settings }, reply => {
            if (!reply.group && callback) callback();
        });
    },

    slicePre(settings, callback) {
        workerSend('slicePre', { settings }, callback);
    },

    slice(settings, widget, callback) {
        workerSend('slice', { id: widget.id, settings }, reply => {
            callback(reply);
        });
    },

    slicePost(settings, callback) {
        workerSend('slicePost', { settings }, callback);
    },

    prepare(settings, update, done) {
        workerSend('prepare', { settings }, reply => {
            if (reply.progress) update(reply.progress, reply.message, reply.layer);
            if (reply.done)  done(reply.output, reply.maxSpeed, reply.minSpeed);
            if (reply.error) done(reply);
        });
    },

    export(settings, online, ondone) {
        workerSend('export', { settings }, reply => {
            if (reply.line)  online(reply.line);
            if (reply.done)  ondone(reply.output);
            if (reply.error) ondone(null, reply.error);
        });
    },
};
