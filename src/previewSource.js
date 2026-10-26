// Shell animates restored windows from their dock icon. Capturing during that
// animation can cache a flattened sliver in an otherwise full-sized texture.
const ANIMATED_PROPERTIES = ['scale-x', 'scale-y', 'opacity', 'x', 'y'];

export function previewSourceIsAnimating(source) {
    return Boolean(source && ANIMATED_PROPERTIES.some(name => source.get_transition(name)));
}

export function previewSourceIsStable(source) {
    return Boolean(source && source.visible && source.width > 0 && source.height > 0 &&
        source.scale_x === 1 && source.scale_y === 1 && source.opacity === 255 &&
        !previewSourceIsAnimating(source));
}
