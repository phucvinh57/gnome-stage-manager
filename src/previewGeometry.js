export const PREVIEW_SKEW = 0.06;

// Smoothly fan the visible stack: down at the top, flat in the middle,
// up at the bottom on the left (mirrored on the right). A single preview stays flat.
export function previewSlope(index, count, edge) {
    const position = count > 1 ? 1 - 2 * index / (count - 1) : 0;
    return PREVIEW_SKEW * position * (edge === 'right' ? -1 : 1);
}

// Affine shear: vertical edges stay equal and upright.
// Translate upward-sloping previews into positive allocation coordinates.
// Column-major Graphene matrix.
export function previewTransform(width, slope) {
    return [
        1, slope, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, Math.max(0, -slope * width), 0, 1,
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
