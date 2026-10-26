import assert from 'node:assert/strict';
import test from 'node:test';
import {stageGeometry} from '../src/stageGeometry.js';

const area = {x: 120, y: 32, width: 1920, height: 1048};

for (const edge of ['left', 'right']) {
    test(`${edge}: a lone window fills the work area with padding on every side`, () => {
        for (const padding of [0, 16, 96, 128]) {
            const geometry = stageGeometry(area, edge, 180, padding, 80, 24, true, false);
            assert.deepEqual(geometry.window, {
                x: area.x + padding,
                y: area.y + padding,
                width: area.width - 2 * padding,
                height: area.height - 2 * padding,
            });
            assert.equal(geometry.hasStrip, false);
            assert.equal(geometry.strip.width, 0);
        }
    });

    test(`${edge}: opening a second window reserves the sidebar again`, () => {
        const single = stageGeometry(area, edge, 180, 16, 80, 24, true, false);
        const multiple = stageGeometry(area, edge, 180, 16, 80, 24, true, true);
        assert.equal(multiple.hasStrip, true);
        assert.ok(multiple.window.width < single.window.width);
        assert.deepEqual(multiple, stageGeometry(area, edge, 180, 16, 80, 24, true));
    });

    test(`${edge}: matched sidebar gaps stay equal as window padding changes`, () => {
        const original = stageGeometry(area, edge, 180, 16, 80, 24, true);
        const padded = stageGeometry(area, edge, 180, 96, 80, 24, true);
        assert.deepEqual(padded.strip, original.strip);
        const outerGap = edge === 'left'
            ? padded.strip.x - area.x
            : area.x + area.width - padded.strip.x - padded.strip.width;
        const innerGap = edge === 'left'
            ? padded.window.x - padded.strip.x - padded.strip.width
            : padded.strip.x - padded.window.x - padded.window.width;
        assert.equal(outerGap, 24);
        assert.equal(innerGap, outerGap);
        assert.equal(padded.window.y - area.y, 96);
        assert.equal(padded.window.height, area.height - 192);
        const windowOuterGap = edge === 'left'
            ? area.x + area.width - padded.window.x - padded.window.width
            : padded.window.x - area.x;
        assert.equal(windowOuterGap, 96);
    });

    test(`${edge}: custom sidebar gap is independent of both margins`, () => {
        const {window, strip} = stageGeometry(area, edge, 180, 64, 40, 12, false);
        const gap = edge === 'left'
            ? window.x - strip.x - strip.width
            : strip.x - window.x - window.width;
        assert.equal(gap, 40);
    });

    test(`${edge}: small work areas keep all allocations inside the work area`, () => {
        for (const width of [1, 2, 3, 40, 100, 300]) {
            const small = {...area, width, height: 200};
            for (const reserveStrip of [false, true]) {
                const geometry = stageGeometry(small, edge, 320, 128, 128, 128, true, reserveStrip);
                for (const rect of [geometry.window, geometry.strip]) {
                    assert.ok(rect.x >= small.x);
                    assert.ok(rect.x + rect.width <= small.x + small.width);
                    assert.ok(rect.y >= small.y);
                    assert.ok(rect.y + rect.height <= small.y + small.height);
                }
                assert.ok(geometry.window.width >= 1);
            }
        }
    });
}
