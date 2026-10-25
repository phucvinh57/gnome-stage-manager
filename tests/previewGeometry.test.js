import assert from 'node:assert/strict';
import test from 'node:test';
import {previewTransform, snapshotSize} from '../src/previewGeometry.js';

function project(matrix, x, y) {
    const w = matrix[3] * x + matrix[7] * y + matrix[15];
    return [(matrix[0] * x + matrix[4] * y + matrix[12]) / w,
        (matrix[1] * x + matrix[5] * y + matrix[13]) / w];
}

for (const [width, height] of [[160, 90], [240, 336], [1, 1]]) {
    test(`trapezium projection preserves upright edges at ${width}×${height}`, () => {
        const matrix = previewTransform(width, height);
        const corners = [[0, 0], [width, 0], [width, height], [0, height]]
            .map(([x, y]) => project(matrix, x, y));
        const expected = [[0, 0], [width * 0.9, height * 0.14],
            [width * 0.9, height * 0.86], [0, height]];
        corners.forEach((point, i) => point.forEach((value, axis) => {
            assert.ok(Math.abs(value - expected[i][axis]) < 0.00001);
        }));
    });
}

for (const [width, height, expected] of [
    [3840, 2400, {width: 640, height: 400}],
    [7680, 4800, {width: 640, height: 400}],
    [1200, 3000, {width: 358, height: 896}],
    [100, 80, {width: 100, height: 80}],
    [1, 10000, {width: 1, height: 896}],
]) {
    test(`snapshot downsampling bounds ${width}×${height}`, () => {
        assert.deepEqual(snapshotSize(width, height), expected);
    });
}
