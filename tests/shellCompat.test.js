import test from 'node:test';
import assert from 'node:assert/strict';
import {maximizeFlags} from '../src/shellCompat.js';

test('maximizeFlags uses get_maximize_flags on Mutter 49+', () => {
    assert.equal(maximizeFlags({get_maximize_flags: () => 3}), 3);
});

test('maximizeFlags derives flags from properties on Mutter 46-48', () => {
    assert.equal(maximizeFlags({maximized_horizontally: false, maximized_vertically: false}), 0);
    assert.equal(maximizeFlags({maximized_horizontally: true, maximized_vertically: false}), 1);
    assert.equal(maximizeFlags({maximized_horizontally: false, maximized_vertically: true}), 2);
    assert.equal(maximizeFlags({maximized_horizontally: true, maximized_vertically: true}), 3);
});
