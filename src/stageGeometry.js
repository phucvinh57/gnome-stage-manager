// All coordinates are logical stage pixels. A lone window uses the full work
// area with window padding; multiple stages reserve space for the strip.
export function stageGeometry(area, edge, previewWidth, padding, gap,
    stripPadding = padding, matchSpacing = false, reserveStrip = true) {
    const limit = Math.max(0, Math.floor((Math.min(area.width, area.height) - 1) / 2));
    const inset = Math.max(0, Math.min(padding, limit));
    const stripInset = Math.max(0, Math.min(stripPadding, limit));
    const available = Math.max(1, area.width - inset - stripInset);
    const stripWidth = reserveStrip
        ? Math.min(previewWidth, Math.max(0, Math.floor(available / 2))) : 0;
    const space = Math.min(matchSpacing ? stripInset : gap,
        Math.max(0, available - stripWidth - 1));
    const hasStrip = stripWidth > 0 && available >= 2;
    const left = edge === 'left';
    return {
        window: {
            x: area.x + (left && hasStrip ? stripInset + stripWidth + space : inset),
            y: area.y + inset,
            width: hasStrip ? available - stripWidth - space : Math.max(1, area.width - 2 * inset),
            height: Math.max(1, area.height - 2 * inset),
        },
        strip: {
            x: left ? area.x + stripInset : area.x + area.width - stripInset - stripWidth,
            y: area.y + stripInset,
            width: stripWidth,
            height: Math.max(1, area.height - 2 * stripInset),
        },
        hasStrip,
    };
}
