import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {URL} from 'node:url';
import {SourceTextModule, SyntheticModule} from 'node:vm';

import * as previewSource from '../src/previewSource.js';

// Exercise the Shell classes without starting or modifying a desktop session.
async function loadShellClass(path, name, overrides = {}) {
    const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'));
    await module.link(specifier => {
        const exports = overrides[specifier] ?? (specifier === './previewSource.js' ? previewSource : {
            default: {}, StageModel: class {}, MinimizeLedger: class {},
            WindowTracker: class {}, StageStrip: class {}, WindowArranger: class {},
            stageGeometry() {}, previewTransform() {}, snapshotSize() {},
            RoundedPreviewEffect: class {},
            maximizeFlags() {}, unmaximizeWindow() {},
        });
        return new SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports))
                this.setExport(key, value);
        });
    });
    await module.evaluate();
    return module.namespace[name];
}

const StagePreview = await loadShellClass('../src/stagePreview.js', 'StagePreview');
const StageController = await loadShellClass('../src/stageController.js', 'StageController');
const WindowTracker = await loadShellClass('../src/windowTracker.js', 'WindowTracker');
const WindowArranger = await loadShellClass('../src/windowArranger.js', 'WindowArranger');

test('preview masks the unclipped surface outside the hard content crop', async () => {
    class Actor {
        constructor(properties = {}) {
            Object.assign(this, properties);
            this.children = [];
            this.effects = [];
        }

        set_child(child) { this.add_child(child); }
        add_child(child) { this.children.push(child); }
        add_effect(effect) { this.effects.push(effect); }
        set_pivot_point() {}
        connect() { return 1; }
    }
    const Preview = await loadShellClass('../src/stagePreview.js', 'StagePreview', {
        'gi://St': {default: {Button: Actor, Widget: Actor, Icon: Actor}},
        'gi://Clutter': {default: {BinLayout: class {}, ActorAlign: {}}},
    });
    class ConstructionPreview extends Preview {
        _updateTitle() {}
        _syncThumbnail() {}
        refresh() {}
    }
    const preview = new ConstructionPreview({id: 'test', window: {connect() { return 1; }}});
    // Both live clones and snapshots share this crop. The final mask must be
    // outside it, so Clutter cannot stencil away partial edge coverage.
    assert.equal(preview._thumbnail.clip_to_allocation, true);
    assert.equal(preview._surface.clip_to_allocation, false);
    assert.ok(preview._surface.children.includes(preview._thumbnail));
    assert.deepEqual(preview._thumbnail.effects, []);
    assert.deepEqual(preview._surface.effects, [preview._roundedEffect]);
});

function source(overrides = {}) {
    return {
        visible: true, width: 1600, height: 1000,
        scale_x: 1, scale_y: 1, opacity: 255,
        get_transition: () => null,
        ...overrides,
    };
}

test('unlock animation cannot overwrite the last good snapshot or create a live clone', () => {
    const snapshot = {};
    const preview = Object.assign(Object.create(StagePreview.prototype), {
        actor: {}, _window: {minimized: false}, _awaitingFrame: false,
        _snapshot: snapshot, refresh() {},
    });
    for (const overrides of [
        {scale_y: 0.001}, {scale_x: 0}, {opacity: 0}, {visible: false},
        {width: 0}, {height: 0},
        ...['scale-x', 'scale-y', 'opacity', 'x', 'y'].map(property => ({
            get_transition: name => name === property ? {} : null,
        })),
    ]) {
        preview._source = source({
            paint_to_content_full() { assert.fail('must not capture an animation frame'); },
            ...overrides,
        });
        assert.equal(Boolean(preview._isVisibleSource()), false);
        assert.equal(preview.capture(), false);
        assert.equal(preview._snapshot, snapshot);
    }
    preview._source = source();
    assert.equal(Boolean(preview._isVisibleSource()), true);
    preview._window.minimized = true;
    assert.equal(Boolean(preview._isVisibleSource()), false);
    assert.equal(preview.capture(), false);
});

test('resume waits for restore animation, then captures before minimizing once', () => {
    const events = [];
    let animating = true;
    const actor = source({get_transition: name => animating && name === 'scale-y' ? {} : null});
    const window = {
        minimized: false, get_compositor_private: () => actor, can_minimize: () => true,
    };
    const controller = Object.assign(Object.create(StageController.prototype), {
        _model: {activeId: 'active', windows: [{id: 'inactive', window}]},
        _arranger: {isPending: () => false},
        _tracker: {familyFor: () => [window]},
        _strip: {capture: () => events.push('capture')},
        _ledger: {minimize: () => { events.push('minimize'); window.minimized = true; }},
    });
    controller._applyVisibility();
    assert.deepEqual(events, []);
    animating = false;
    controller._applyVisibility();
    assert.deepEqual(events, ['capture', 'minimize']);
});

test('lock screen pauses stages without restoring, capturing, or minimizing windows', async () => {
    const sessionMode = {isLocked: true, isGreeter: false};
    const Controller = await loadShellClass('../src/stageController.js', 'StageController', {
        'resource:///org/gnome/shell/ui/main.js': {sessionMode},
    });
    const events = [];
    const fail = name => () => assert.fail(`${name} while locked`);
    const controller = Object.assign(Object.create(Controller.prototype), {
        _destroyed: false, _refreshId: 0,
        _tracker: {records: []},
        _strip: {
            retain: () => events.push('retain'),
            setVisible: visible => events.push(['visible', visible]),
            capture: fail('capture'),
        },
        _ledger: {restoreAll: fail('restore'), minimize: fail('minimize')},
        _arranger: {releaseAll: fail('release geometry')},
    });
    controller._refresh();
    assert.deepEqual(events, ['retain', ['visible', false]]);
});

test('opening a stage preserves the previous window until the new stage is ready', () => {
    const events = [];
    let pending = false;
    let animating = false;
    const actor = source({get_transition: name => animating && name === 'opacity' ? {} : null});
    const active = {
        id: 'new', awaitingFrame: true,
        window: {get_compositor_private: () => actor},
    };
    const previous = {
        id: 'previous',
        window: {minimized: false, can_minimize: () => true,
            get_compositor_private: () => source()},
    };
    const controller = Object.assign(Object.create(StageController.prototype), {
        _model: {activeId: active.id, windows: [previous, active]},
        _arranger: {isPending: window => window === active.window && pending},
        _tracker: {familyFor: window => [window]},
        _strip: {capture: window => events.push(['capture', window])},
        _ledger: {
            restore: window => events.push(['restore', window]),
            minimize: window => events.push(['minimize', window]),
        },
    });
    for (const phase of ['first-frame', 'resize', 'map-animation']) {
        active.awaitingFrame = phase === 'first-frame';
        pending = phase === 'resize';
        animating = phase === 'map-animation';
        controller._applyVisibility();
        assert.deepEqual(events.splice(0), [['restore', active.window]], phase);
    }
    animating = false;
    controller._applyVisibility();
    assert.deepEqual(events, [
        ['restore', active.window],
        ['capture', previous.window],
        ['minimize', previous.window],
    ]);
});

test('sidebar stays visible during client resize settling but hides for constraints and drags', () => {
    const window = {};
    const arranger = Object.assign(Object.create(WindowArranger.prototype), {
        _states: new Map(), _grabbed: new Set(),
    });
    assert.equal(arranger.canShowStrip(window), true);
    const state = {timeoutId: 1, constrained: false};
    arranger._states.set(window, state);
    assert.equal(arranger.canShowStrip(window), true);
    state.timeoutId = 0;
    assert.equal(arranger.canShowStrip(window), true);
    state.constrained = true;
    assert.equal(arranger.canShowStrip(window), false);
    state.constrained = false;
    arranger._grabbed.add(window);
    assert.equal(arranger.canShowStrip(window), false);
});

test('animation completion schedules reconciliation and actor teardown disconnects watchers', () => {
    const handlers = new Map();
    let nextId = 1;
    let changes = 0;
    const actor = {
        connect(signal, callback) {
            const id = nextId++;
            handlers.set(id, {signal, callback});
            return id;
        },
        disconnect(id) { assert.equal(handlers.delete(id), true); },
    };
    const window = {get_compositor_private: () => actor, connect: () => nextId++};
    const tracker = new WindowTracker(() => changes++, () => {}, () => {});
    tracker._track(window, false);
    assert.equal(changes, 1);
    for (const signal of ['effects-completed', 'transitions-completed']) {
        [...handlers.values()].find(handler => handler.signal === signal).callback();
    }
    assert.equal(changes, 3);
    [...handlers.values()].find(handler => handler.signal === 'destroy').callback();
    assert.equal(handlers.size, 0);
    tracker._stopEffectWatch(tracker._windows.get(window));
});
