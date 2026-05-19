/** headless stub — path rendering is browser-only visualization, not needed for slicing */

export const render = {
    path: () => Promise.resolve([]),
    rate_to_color: () => 0,
};
