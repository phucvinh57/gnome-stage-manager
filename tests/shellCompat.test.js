import assert from 'node:assert/strict';
import test from 'node:test';

import {maximizeFlags, maximizeWindow, restoreMaximizeFlags, unmaximizeWindow} from '../src/shellCompat.js';

test('Mutter 46–48 maximize methods retain partial flags', () => {
    const calls = [];
    const window = {
        get_maximized: () => 1,
        unmaximize: flags => calls.push(['unmaximize', flags]),
        maximize: flags => calls.push(['maximize', flags]),
    };
    assert.equal(maximizeFlags(window), 1);
    maximizeWindow(window);
    unmaximizeWindow(window);
    restoreMaximizeFlags(window, 1);
    assert.deepEqual(calls, [['maximize', 3], ['unmaximize', 1], ['maximize', 1]]);
});

test('Mutter 49–51 maximize methods retain partial flags', () => {
    const calls = [];
    const window = {
        get_maximize_flags: () => 2,
        maximize: (...args) => calls.push(['maximize', args]),
        unmaximize: (...args) => calls.push(['unmaximize', args]),
        set_maximize_flags: flags => calls.push(['set_maximize_flags', flags]),
    };
    assert.equal(maximizeFlags(window), 2);
    maximizeWindow(window);
    unmaximizeWindow(window);
    restoreMaximizeFlags(window, 2);
    assert.deepEqual(calls, [['maximize', []], ['unmaximize', []], ['set_maximize_flags', 2]]);
});
