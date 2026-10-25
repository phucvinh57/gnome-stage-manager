// Project the whole preview onto a trapezium, independent of the stage camera.
// Left edge stays full height; the right edge is 72% as tall and 90% as far
// across. Column-major Graphene matrix; homogeneous division supplies perspective.
export function previewTransform(width, height) {
    const depth = 1 / 0.72 - 1;
    const perspective = depth / Math.max(1, width);
    return [
        0.9 * (1 + depth), height * perspective / 2, 0, perspective,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];
}

// Enough for the largest 320px-wide card at 2× density, including tall cards.
// Never upscale small surfaces; retain their original aspect ratio.
export function snapshotSize(width, height) {
    const scale = Math.min(1, 640 / width, 896 / height);
    return {
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale)),
    };
}
