import test from 'node:test';
import assert from 'node:assert/strict';
import {MinimizeLedger} from '../src/minimizeLedger.js';

function makeWindow(minimized = false) {
    return {
        _minimized: minimized,
        minimizeCalls: 0,
        unminimizeCalls: 0,
        onChange: null,
        get minimized() {
            return this._minimized;
        },
        minimize() {
            this.minimizeCalls++;
            this._minimized = true;
            this.onChange?.();
        },
        unminimize() {
            this.unminimizeCalls++;
            this._minimized = false;
            this.onChange?.();
        },
    };
}

test('already minimized windows remain user-owned and are never restored', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow(true);
    assert.equal(ledger.minimize(window), false);
    assert.equal(ledger.has(window), false);
    assert.equal(ledger.restore(window), false);
    ledger.restoreAll();
    assert.equal(window.minimized, true);
    assert.equal(window.minimizeCalls, 0);
    assert.equal(window.unminimizeCalls, 0);
});

test('ownership precedes synchronous notification and repeated minimize is a no-op', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    window.onChange = () => {
        assert.equal(ledger.has(window), true);
        ledger.observe(window);
        assert.equal(ledger.has(window), true);
    };
    assert.equal(ledger.minimize(window), true);
    assert.equal(ledger.minimize(window), false);
    assert.equal(window.minimizeCalls, 1);
    assert.deepEqual(ledger.windows, [window]);
    ledger.windows.length = 0;
    assert.deepEqual(ledger.windows, [window]);
});

test('restore releases ownership before calling unminimize', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    ledger.minimize(window);
    const unminimize = window.unminimize;
    window.unminimize = function () {
        assert.equal(ledger.has(this), false);
        unminimize.call(this);
    };
    window.onChange = () => {
        assert.equal(ledger.has(window), false);
        ledger.observe(window);
    };
    assert.equal(ledger.restore(window), true);
    assert.equal(ledger.restore(window), false);
    assert.equal(window.unminimizeCalls, 1);
    assert.equal(window.minimized, false);
});

test('external unminimize removes ownership and can subsequently be minimized again', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    window.onChange = () => ledger.observe(window);
    ledger.minimize(window);
    window.unminimize();
    assert.equal(ledger.has(window), false);
    assert.equal(ledger.restore(window), false);
    ledger.minimize(window);
    assert.equal(ledger.has(window), true);
});

test('restore also drops ownership when an external restore was not observed', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    ledger.minimize(window);
    window.unminimize();
    assert.equal(ledger.restore(window), false);
    assert.equal(ledger.has(window), false);
    assert.equal(window.unminimizeCalls, 1);
});

test('forget drops a closed window without touching it', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    ledger.minimize(window);
    Object.defineProperty(window, 'minimized', {
        get() { throw new Error('closed'); },
    });
    assert.equal(ledger.forget(window), true);
    assert.equal(ledger.forget(window), false);
    ledger.observe(window);
    ledger.restoreAll();
    assert.equal(window.unminimizeCalls, 0);
});

test('restoreAll restores only owned windows', () => {
    const ledger = new MinimizeLedger();
    const windows = [makeWindow(), makeWindow(), makeWindow(true)];
    for (const window of windows) {
        window.onChange = () => ledger.observe(window);
        ledger.minimize(window);
    }
    ledger.restoreAll();
    assert.deepEqual(windows.map(window => window.minimized), [false, false, true]);
    assert.deepEqual(ledger.windows, []);
    ledger.restoreAll();
    assert.deepEqual(windows.map(window => window.unminimizeCalls), [1, 1, 0]);
});

test('failed minimize propagates the error and cleans up ownership', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    const error = new Error('disposed');
    window.minimize = function () {
        assert.equal(ledger.has(this), true);
        throw error;
    };
    assert.throws(() => ledger.minimize(window), caught => caught === error);
    assert.equal(ledger.has(window), false);
});

test('failed restore propagates the error with ownership already removed', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    const error = new Error('disposed');
    ledger.minimize(window);
    window.unminimize = function () {
        assert.equal(ledger.has(this), false);
        throw error;
    };
    assert.throws(() => ledger.restore(window), caught => caught === error);
    assert.equal(ledger.has(window), false);
});

test('a disposed getter during restore cannot retain ownership', () => {
    const ledger = new MinimizeLedger();
    const window = makeWindow();
    ledger.minimize(window);
    Object.defineProperty(window, 'minimized', {
        get() { throw new Error('disposed'); },
    });
    assert.throws(() => ledger.restore(window), /disposed/);
    assert.equal(ledger.has(window), false);
});

test('restoreAll continues after failures and rethrows a single original error', () => {
    const ledger = new MinimizeLedger();
    const failed = makeWindow();
    const healthy = makeWindow();
    const error = new Error('disposed');
    ledger.minimize(failed);
    ledger.minimize(healthy);
    failed.unminimize = () => { throw error; };
    assert.throws(() => ledger.restoreAll(), caught => caught === error);
    assert.equal(healthy.minimized, false);
    assert.deepEqual(ledger.windows, []);
});

test('restoreAll reports multiple failures without leaving owned windows', () => {
    const ledger = new MinimizeLedger();
    const errors = [new Error('first disposed'), new Error('second disposed')];
    for (const error of errors) {
        const window = makeWindow();
        ledger.minimize(window);
        window.unminimize = () => { throw error; };
    }
    assert.throws(() => ledger.restoreAll(), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, errors);
        return true;
    });
    assert.deepEqual(ledger.windows, []);
});
