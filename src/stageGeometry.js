// All coordinates are logical stage pixels. Reserve the strip for every stage,
// including when there is only one window and the strip is hidden.
export function stageGeometry(area, edge, previewWidth, padding, gap) {
    const inset = Math.max(0, Math.min(padding, Math.floor((Math.min(area.width, area.height) - 1) / 2)));
    const inner = {
        x: area.x + inset,
        y: area.y + inset,
        width: Math.max(1, area.width - 2 * inset),
        height: Math.max(1, area.height - 2 * inset),
    };
    const stripWidth = Math.min(previewWidth, Math.max(0, Math.floor(inner.width / 2)));
    const space = Math.min(gap, Math.max(0, inner.width - stripWidth - 1));
    const hasStrip = stripWidth > 0 && inner.width >= 2;
    const windowWidth = hasStrip ? inner.width - stripWidth - space : inner.width;
    const left = edge === 'left';
    return {
        window: {
            x: left && hasStrip ? inner.x + stripWidth + space : inner.x,
            y: inner.y,
            width: windowWidth,
            height: inner.height,
        },
        strip: {
            x: left ? inner.x : inner.x + inner.width - stripWidth,
            y: inner.y,
            width: stripWidth,
            height: inner.height,
        },
        hasStrip,
    };
}
