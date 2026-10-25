import test from 'node:test';
import assert from 'node:assert/strict';
import {stageGeometry} from '../src/stageGeometry.js';

const area = {x: 100, y: 50, width: 1200, height: 800};

test('both strip edges reserve the same window size', () => {
    const right = stageGeometry(area, 'right', 180, 16, 16);
    const left = stageGeometry(area, 'left', 180, 16, 16);
    assert.deepEqual(right.window, {x: 116, y: 66, width: 972, height: 768});
    assert.deepEqual(right.strip, {x: 1104, y: 66, width: 180, height: 768});
    assert.deepEqual(left.window, {x: 312, y: 66, width: 972, height: 768});
    assert.deepEqual(left.strip, {x: 116, y: 66, width: 180, height: 768});
});

test('padding and gap change only their respective spacing', () => {
    const base = stageGeometry(area, 'right', 180, 0, 0);
    const padded = stageGeometry(area, 'right', 180, 24, 0);
    const spaced = stageGeometry(area, 'right', 180, 0, 32);
    assert.equal(base.window.width, 1020);
    assert.equal(padded.window.width, 972);
    assert.equal(padded.window.height, 752);
    assert.equal(spaced.window.width, 988);
    assert.equal(spaced.strip.x - (spaced.window.x + spaced.window.width), 32);
});

test('strip space is reserved independent of stage count', () => {
    const singleStage = stageGeometry(area, 'right', 180, 16, 16);
    assert.equal(singleStage.window.width, area.width - 2 * 16 - 180 - 16);
    assert.equal(singleStage.strip.x -
        (singleStage.window.x + singleStage.window.width), 16);
});

test('small work areas stay positive and keep window separate from strip', () => {
    for (const edge of ['left', 'right']) {
        const geometry = stageGeometry({x: 0, y: 0, width: 90, height: 70}, edge, 320, 16, 128);
        assert(geometry.window.width >= 1 && geometry.window.height >= 1);
        assert(geometry.strip.width >= 1);
        if (edge === 'left')
            assert(geometry.strip.x + geometry.strip.width <= geometry.window.x);
        else
            assert(geometry.window.x + geometry.window.width <= geometry.strip.x);
    }
});
