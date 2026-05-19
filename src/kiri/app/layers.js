/** headless stub — Layers is a browser rendering class, not needed for GCode export */

export class Layers {
    constructor() {
        this.layers = [];
    }

    setRotation(angle) { return this; }

    newLayer(z) {
        const layer = new Layer(z);
        this.layers.push(layer);
        return layer;
    }
}

class Layer {
    constructor(z) {
        this.z = z;
        this.polys = [];
    }

    addPolys(polys) { return this; }
    setLineWidth(w) { return this; }
}
