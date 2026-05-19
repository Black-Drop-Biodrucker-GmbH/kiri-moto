/** headless stub — bin packing is a GUI/laser mode feature */

export class Packer {
    constructor() {}
    pack(tiles, callback) {
        if (callback) callback(tiles);
        return tiles;
    }
}
