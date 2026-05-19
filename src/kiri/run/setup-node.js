/** set up browser-like globals for Node.js before any kiri modules load */

// browser Workers use 'self' as their global scope; Node.js doesn't define it
if (typeof self === 'undefined') {
    globalThis.self = globalThis;
}

// Worker dispatch uses self.postMessage; we override it in client-headless.js
// but need a no-op default so module-level code doesn't throw
if (typeof globalThis.postMessage === 'undefined') {
    globalThis.postMessage = () => {};
}

// some modules check navigator.userAgent
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { userAgent: '', hardwareConcurrency: 1 };
}

// atob / btoa — available in Node.js 18+ but define as fallback
if (typeof globalThis.atob === 'undefined') {
    globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString();
    globalThis.btoa = (str) => Buffer.from(str).toString('base64');
}
