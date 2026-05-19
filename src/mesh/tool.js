/** headless stub — mesh normalization is GUI-only, not called during slicing */

export function tool() {
    return {
        normalizeVertices: (verts) => ({ toFloat32: () => verts }),
    };
}
