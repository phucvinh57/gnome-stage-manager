import assert from 'node:assert/strict';
import test from 'node:test';

import {StageModel} from '../src/stageModel.js';

const record = id => ({id, workspace: 0, monitor: 0, minimized: false});

function model(ids) {
    const stage = new StageModel();
    stage.setContext(0, 0);
    stage.setWindows(ids.map(record));
    return stage;
}

const slots = stage => stage.stripWindows.map(entry => entry.id);

test('switching swaps the previous active preview into the selected slot', () => {
    const stage = model(['a', 'b', 'c', 'd']);
    assert.equal(stage.activeId, 'a');
    stage.activate('c');
    assert.deepEqual(slots(stage), ['c', 'b', 'a', 'd']);
    stage.activate('d');
    assert.deepEqual(slots(stage), ['d', 'b', 'a', 'c']);
    stage.activate('b');
    assert.deepEqual(slots(stage), ['b', 'd', 'a', 'c']);
});

test('slots survive snapshot reordering, append new windows and drop removed ones', () => {
    const stage = model(['a', 'b', 'c']);
    stage.activate('c');
    stage.setWindows(['b', 'c', 'a', 'e'].map(record));
    assert.deepEqual(slots(stage), ['c', 'b', 'a', 'e']);
    stage.remove('b');
    assert.deepEqual(slots(stage), ['c', 'a', 'e']);
    stage.activate('e');
    assert.deepEqual(slots(stage), ['e', 'a', 'c']);
});

test('closing the active window does not swap the fallback', () => {
    const stage = model(['a', 'b', 'c']);
    stage.activate('c');
    stage.activate('b');
    assert.deepEqual(slots(stage), ['b', 'c', 'a']);
    stage.remove('b');
    assert.equal(stage.activeId, 'c');
    assert.deepEqual(slots(stage), ['c', 'a']);
});

test('cycling keeps discovery order', () => {
    const stage = model(['a', 'b', 'c']);
    const visited = [];
    for (let i = 0; i < 3; i++) {
        stage.activate(stage.nextId(1));
        visited.push(stage.activeId);
    }
    assert.deepEqual(visited, ['b', 'c', 'a']);
});
