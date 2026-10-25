// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {StageModel} from './stageModel.js';
import {MinimizeLedger} from './minimizeLedger.js';
import {WindowTracker} from './windowTracker.js';
import {StageStrip} from './stageStrip.js';

export class StageController {
    constructor(settings) {
        this._settings = settings;
        this._model = new StageModel();
        this._ledger = new MinimizeLedger();
        this._connections = [];
        this._refreshId = 0;
        this._lastFocus = null;
        this._pendingRestore = null;
        this._tracker = new WindowTracker(
            () => this._queueRefresh(),
            window => {
                this._ledger.forget(window);
                if (this._pendingRestore === window)
                    this._pendingRestore = null;
            },
            window => {
                // Controller restores release ownership before unminimizing.
                // An owned window becoming visible is therefore external intent.
                if (this._ledger.has(window) && !window.minimized)
                    this._pendingRestore = this._tracker.rootFor(window);
                this._ledger.observe(window);
            });
        this._strip = null;
    }

    start() {
        this._strip = new StageStrip(this._settings, id => this.activate(id));
        this._connect(this._settings, 'changed', () => this._queueRefresh());
        this._connect(global.workspace_manager, 'active-workspace-changed', () => this._queueRefresh());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._queueRefresh());
        this._connect(global.display, 'workareas-changed', () => this._queueRefresh());
        this._connect(global.display, 'in-fullscreen-changed', () => this._queueRefresh());
        this._connect(Main.overview, 'showing', () => this._refresh());
        this._connect(Main.overview, 'hidden', () => this._queueRefresh());
        this._connect(Main.sessionMode, 'updated', () => this._refresh());
        this._tracker.start();
        this._refresh();
    }

    _connect(object, signal, callback) {
        this._connections.push([object, object.connect(signal, callback)]);
    }

    get activeId() {
        return this._model.activeId;
    }

    get records() {
        return this._model.windows;
    }

    get suspended() {
        return !this._settings.get_boolean('stage-enabled') ||
            Main.overview.visible || Main.sessionMode.isLocked ||
            Main.sessionMode.isGreeter || Main.layoutManager.primaryIndex < 0;
    }

    _queueRefresh() {
        if (this._refreshId)
            return;
        this._refreshId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._refreshId = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        if (this.suspended) {
            this._ledger.restoreAll();
            this._lastFocus = null;
            this._pendingRestore = null;
            this._strip.setVisible(false);
            return;
        }

        const workspace = global.workspace_manager.get_active_workspace_index();
        const monitor = Main.layoutManager.primaryIndex;
        const records = this._tracker.records;
        const inContext = records.filter(record => record.workspace === workspace && record.monitor === monitor);
        const members = new Set(inContext.flatMap(record => this._tracker.familyFor(record.window)));
        for (const window of this._ledger.windows) {
            if (!members.has(window))
                this._ledger.restore(window);
        }

        this._model.setContext(workspace, monitor);
        this._model.setWindows(records.map(record => ({
            ...record,
            minimized: record.minimized && !this._ledger.has(record.window),
        })));
        const focus = this._tracker.rootFor(global.display.focus_window);
        const focusedRecord = inContext.find(record => record.window === focus);
        // Only an actual focus change should select another stage. In particular,
        // refreshing titles or geometry must not reverse a keyboard/click selection.
        if (focusedRecord && focus !== this._lastFocus && !focusedRecord.window.minimized)
            this._model.activate(focusedRecord.id);
        const restored = inContext.find(record => record.window === this._pendingRestore);
        if (restored && !restored.window.minimized)
            this._model.activate(restored.id);
        this._pendingRestore = null;
        this._lastFocus = focus;

        this._strip.prepare(this._model.windows);
        this._applyVisibility();
        this._strip.update(this._model.windows, this._model.activeId);
        this._strip.setVisible(!global.display.get_monitor_in_fullscreen(monitor));
    }

    _applyVisibility() {
        const active = this._model.windows.find(record => record.id === this._model.activeId);
        // Restore the selected family first so minimizing the old focus doesn't
        // temporarily leave Mutter with only unrelated focus candidates.
        if (active) {
            for (const window of this._tracker.familyFor(active.window))
                this._ledger.restore(window);
        }
        for (const record of this._model.windows) {
            if (record.id === this._model.activeId)
                continue;
            if (!record.window.minimized)
                this._strip.capture(record.window);
            // Children first: parent minimization may also minimize dialogs.
            for (const window of this._tracker.familyFor(record.window).reverse()) {
                if (window.can_minimize())
                    this._ledger.minimize(window);
            }
        }
    }

    activate(id) {
        if (this.suspended)
            return;
        const workspace = global.workspace_manager.get_active_workspace_index();
        const monitor = Main.layoutManager.primaryIndex;
        const snapshot = this._tracker.records;
        const record = snapshot.find(candidate => candidate.id === id &&
            candidate.workspace === workspace && candidate.monitor === monitor);
        if (!record)
            return;
        this._model.setContext(workspace, monitor);
        this._model.setWindows(snapshot.map(candidate => ({
            ...candidate,
            minimized: candidate.minimized && !this._ledger.has(candidate.window),
        })));
        this._strip.prepare(this._model.windows);
        // Explicit selection may restore the root, but must preserve dialogs
        // that the user minimized independently.
        for (const window of this._tracker.familyFor(record.window))
            this._ledger.restore(window);
        if (record.window.minimized)
            record.window.unminimize();
        this._model.setWindows(this._tracker.records.map(candidate => ({
            ...candidate,
            minimized: candidate.minimized && !this._ledger.has(candidate.window),
        })));
        if (!this._model.activate(id))
            return;
        this._lastFocus = record.window;
        Main.activateWindow(record.window);
        this._applyVisibility();
        this._queueRefresh();
    }

    cycle(direction) {
        if (!this._settings.get_boolean('stage-enabled'))
            this._settings.set_boolean('stage-enabled', true);
        this._refresh();
        const id = this._model.nextId(direction);
        if (id !== null)
            this.activate(id);
    }

    destroy() {
        if (this._refreshId) {
            GLib.Source.remove(this._refreshId);
            this._refreshId = 0;
        }
        for (const [object, id] of this._connections)
            object.disconnect(id);
        this._connections = [];
        this._tracker.destroy();
        this._pendingRestore = null;
        this._lastFocus = null;
        try {
            this._ledger.restoreAll();
        } finally {
            if (this._strip) {
                this._strip.destroy();
                this._strip = null;
            }
            this._settings = null;
        }
    }
}
