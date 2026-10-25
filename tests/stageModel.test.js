import test from 'node:test';
import assert from 'node:assert/strict';
import {StageModel} from '../src/stageModel.js';

const windowRecord = (id, overrides = {}) => ({
    id, workspace: 0, monitor: 0, minimized: false, ...overrides,
});
const ids = records => records.map(record => record.id);
const create = (records = []) => {
    const model = new StageModel();
    model.setContext(0, 0);
    model.setWindows(records);
    return model;
};

test('empty model and snapshots before an explicit context', () => {
    const model = new StageModel();
    assert.equal(model.activeId, null);
    assert.deepEqual(model.windows, []);
    assert.deepEqual(model.orderedWindows, []);
    assert.equal(model.nextId(), null);
    assert.equal(model.nextId(-1), null);
    assert.equal(model.activate('a'), false);
    assert.equal(model.remove('missing'), false);
    model.setWindows([windowRecord('a')]);
    assert.equal(model.activeId, null);
    model.setContext(0, 0);
    assert.equal(model.activeId, 'a');
    model.setWindows([]);
    assert.equal(model.activeId, null);
});

test('context filters both workspace and monitor, including minimized records', () => {
    const model = create([
        windowRecord('a'),
        windowRecord('b', {workspace: 1}),
        windowRecord('c', {monitor: 1}),
        windowRecord('d', {workspace: 1, monitor: 1}),
        windowRecord('e', {minimized: true}),
    ]);
    assert.deepEqual(ids(model.windows), ['a', 'e']);
    assert.equal(model.activate('b'), false);
    assert.equal(model.activate('e'), false);
    model.setContext(1, 0);
    assert.equal(model.activeId, 'b');
    assert.deepEqual(ids(model.windows), ['b']);
    model.setContext(0, 1);
    assert.equal(model.activeId, 'c');
    model.setContext(1, 1);
    assert.equal(model.activeId, 'd');
    model.setContext(99, 99);
    assert.equal(model.activeId, null);
    assert.deepEqual(model.windows, []);
    model.setContext(0, 0);
    assert.equal(model.activeId, 'a');
});

test('context identity is strict and supports opaque workspace objects', () => {
    const workspace = {};
    const otherWorkspace = {};
    const model = create([
        windowRecord('a', {workspace}),
        windowRecord('b', {workspace: otherWorkspace}),
        windowRecord('c', {workspace, monitor: '0'}),
    ]);
    assert.equal(model.activeId, null);
    model.setContext(workspace, 0);
    assert.deepEqual(ids(model.windows), ['a']);
    model.setContext(workspace, '0');
    assert.equal(model.activeId, 'c');
});

test('preserves active across refresh and reordering, updating record metadata', () => {
    const model = create([windowRecord('a'), windowRecord('b')]);
    assert.equal(model.activate('b'), true);
    model.setWindows([
        windowRecord('c'), windowRecord('b', {title: 'Updated'}), windowRecord('a'),
    ]);
    assert.equal(model.activeId, 'b');
    assert.deepEqual(ids(model.windows), ['a', 'b', 'c']);
    assert.equal(model.windows[1].title, 'Updated');
    model.setContext(0, 0);
    assert.equal(model.activeId, 'b');
});

test('close fallback prefers MRU over discovery order, then first nonminimized', () => {
    const model = create(['a', 'b', 'c', 'd'].map(id => windowRecord(id)));
    model.activate('c');
    model.activate('b');
    assert.equal(model.remove('b'), true);
    assert.equal(model.activeId, 'c');
    model.setWindows([windowRecord('a'), windowRecord('d')]);
    assert.equal(model.activeId, 'a');
    model.remove('a');
    assert.equal(model.activeId, 'd');
    model.remove('d');
    assert.equal(model.activeId, null);
});

test('context changes recover each context MRU without choosing other contexts', () => {
    const records = [windowRecord('a'), windowRecord('b'),
        windowRecord('x', {workspace: 1}), windowRecord('y', {workspace: 1})];
    const model = create(records);
    model.activate('b');
    model.setContext(1, 0);
    model.activate('y');
    model.setContext(0, 0);
    assert.equal(model.activeId, 'b');
    model.setWindows(records.filter(record => record.id !== 'b'));
    assert.equal(model.activeId, 'a');
    model.setContext(1, 0);
    assert.equal(model.activeId, 'y');
});

test('all minimized means null, skips minimized on fallback and cycling', () => {
    const model = create([windowRecord('a', {minimized: true}),
        windowRecord('b', {minimized: true})]);
    assert.equal(model.activeId, null);
    assert.deepEqual(ids(model.windows), ['a', 'b']);
    assert.equal(model.nextId(), null);
    assert.equal(model.activate('a'), false);
    model.setWindows([windowRecord('a', {minimized: true}), windowRecord('b'), windowRecord('c')]);
    assert.equal(model.activeId, 'b');
    assert.equal(model.nextId(), 'c');
    assert.equal(model.nextId(-1), 'c');
    model.setWindows([windowRecord('a'), windowRecord('b', {minimized: true}), windowRecord('c')]);
    assert.equal(model.activeId, 'a');
    model.setWindows([windowRecord('a', {minimized: true}), windowRecord('b', {minimized: true})]);
    assert.equal(model.activeId, null);
});

test('controller-owned minimized windows retain selection with logical minimized false', () => {
    const model = create([windowRecord('a'), windowRecord('b')]);
    model.activate('b');
    model.setWindows([windowRecord('a'), windowRecord('b', {minimized: false, physicallyMinimized: true})]);
    assert.equal(model.activeId, 'b');
    assert.equal(model.activate('b'), true);
    model.setWindows([windowRecord('a'), windowRecord('b', {minimized: true})]);
    assert.equal(model.activeId, 'a');
});

test('duplicate IDs are first-wins; invalid records ignored; zero ID is valid', () => {
    const model = create([null, undefined, {}, {id: null},
        windowRecord(0, {title: 'First'}), windowRecord(0, {title: 'Duplicate'}),
        windowRecord('a', {minimized: true}), windowRecord('a'), windowRecord('b')]);
    assert.deepEqual(ids(model.windows), [0, 'a', 'b']);
    assert.equal(model.windows[0].title, 'First');
    assert.equal(model.activeId, 0);
    assert.equal(model.activate('a'), false);
    assert.equal(model.remove(0), true);
    assert.equal(model.activeId, 'b');
});

test('rapid activation keeps unique MRU entries and failed activation is a no-op', () => {
    const model = create(['a', 'b', 'c', 'd'].map(id => windowRecord(id)));
    for (let i = 0; i < 100; i++) {
        model.activate('b');
        model.activate('c');
        model.activate('a');
    }
    assert.equal(model.activate('a'), true);
    assert.deepEqual(ids(model.orderedWindows), ['a', 'c', 'b', 'd']);
    assert.equal(model.activate('missing'), false);
    assert.equal(model.activeId, 'a');
    assert.deepEqual(ids(model.orderedWindows), ['a', 'c', 'b', 'd']);
});

test('stable next/previous cycle does not alternate with changing MRU or snapshot order', () => {
    const model = create(['a', 'b', 'c'].map(id => windowRecord(id)));
    const visited = [];
    for (let i = 0; i < 6; i++) {
        const next = model.nextId();
        visited.push(next);
        model.activate(next);
        model.setWindows([...model.orderedWindows].reverse());
    }
    assert.deepEqual(visited, ['b', 'c', 'a', 'b', 'c', 'a']);
    assert.equal(model.nextId(-1), 'c');
    model.activate(model.nextId(-1));
    assert.equal(model.nextId(-1), 'b');
    model.activate(model.nextId(-1));
    assert.equal(model.nextId(-1), 'a');
    assert.equal(model.nextId(0), 'b');
    assert.equal(model.nextId(100), 'c');
    assert.equal(model.nextId(-100), 'a');
    assert.equal(model.activeId, 'b', 'nextId must not mutate selection');
});

test('cycle adapts to removal, insertion, minimization and singleton contexts', () => {
    const model = create(['a', 'b', 'c'].map(id => windowRecord(id)));
    model.remove('b');
    model.setWindows([windowRecord('d'), windowRecord('c'), windowRecord('a')]);
    assert.deepEqual(ids(model.windows), ['a', 'c', 'd']);
    assert.equal(model.nextId(), 'c');
    model.setWindows([windowRecord('a'), windowRecord('c', {minimized: true}), windowRecord('d')]);
    assert.equal(model.nextId(), 'd');
    model.remove('d');
    assert.equal(model.nextId(), 'a');
    assert.equal(model.nextId(-1), 'a');
    model.remove('a');
    assert.equal(model.nextId(), null);
});

test('removed IDs lose MRU history and reappearing IDs append to discovery order', () => {
    const model = create(['a', 'b', 'c'].map(id => windowRecord(id)));
    model.activate('b');
    model.remove('b');
    model.setWindows(['b', 'a', 'c'].map(id => windowRecord(id)));
    assert.deepEqual(ids(model.windows), ['a', 'c', 'b']);
    assert.deepEqual(ids(model.orderedWindows), ['a', 'c', 'b']);
});

test('input/output record and array mutations do not corrupt model state', () => {
    const record = windowRecord('a', {title: 'Original'});
    const model = create([record, windowRecord('b')]);
    record.minimized = true;
    record.title = 'Changed';
    const windows = model.windows;
    windows[0].workspace = 9;
    windows.pop();
    const ordered = model.orderedWindows;
    ordered[0].id = 'wrong';
    ordered.reverse();
    assert.equal(model.activeId, 'a');
    assert.equal(model.windows[0].title, 'Original');
    assert.deepEqual(ids(model.windows), ['a', 'b']);
    assert.deepEqual(ids(model.orderedWindows), ['a', 'b']);
});
