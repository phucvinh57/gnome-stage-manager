import assert from 'node:assert/strict';
import {test} from 'node:test';

import {PREVIEW_SKEW, previewSlope} from '../src/previewGeometry.js';

test('left previews slope down at the top and up at the bottom', () => {
    assert.equal(previewSlope(0, 5, 'left'), PREVIEW_SKEW);
    assert.equal(previewSlope(1, 5, 'left'), PREVIEW_SKEW / 2);
    assert.equal(Math.abs(previewSlope(2, 5, 'left')), 0);
    assert.equal(previewSlope(3, 5, 'left'), -PREVIEW_SKEW / 2);
    assert.equal(previewSlope(4, 5, 'left'), -PREVIEW_SKEW);
});

test('right previews mirror the left sidebar slopes', () => {
    for (let index = 0; index < 5; index++)
        assert.equal(previewSlope(index, 5, 'right'), -previewSlope(index, 5, 'left'));
});

test('a single preview stays flat on either sidebar', () => {
    for (const edge of ['left', 'right'])
        assert.equal(Math.abs(previewSlope(0, 1, edge)), 0);
});
