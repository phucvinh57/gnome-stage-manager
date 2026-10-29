import test from 'node:test';
import assert from 'node:assert/strict';
import {closeAllWindows} from '../src/closeAll.js';

const NORMAL = 0;
const DIALOG = 3;

function mockWindow(overrides = {}) {
    const window = {
        deleted: null,
        type: NORMAL,
        parent: null,
        overrideRedirect: false,
        skip_taskbar: false,
        closable: true,
        ...overrides,
    };
    window.get_window_type = () => window.type;
    window.get_transient_for = () => window.parent;
    window.is_override_redirect = () => window.overrideRedirect;
    window.can_close = () => window.closable;
    window.delete = time => {
        window.deleted = time;
    };
    return window;
}

test('closeAllWindows closes eligible normal windows with the event time', () => {
    const windows = [mockWindow(), mockWindow()];
    closeAllWindows(windows, NORMAL, 42);
    assert.deepEqual(windows.map(window => window.deleted), [42, 42]);
});

test('closeAllWindows skips ineligible windows', () => {
    const root = mockWindow();
    const skipped = [
        mockWindow({type: DIALOG}),
        mockWindow({parent: root}),
        mockWindow({overrideRedirect: true}),
        mockWindow({skip_taskbar: true}),
        mockWindow({closable: false}),
    ];
    closeAllWindows([root, ...skipped], NORMAL, 7);
    assert.equal(root.deleted, 7);
    assert.deepEqual(skipped.map(window => window.deleted), [null, null, null, null, null]);
});
