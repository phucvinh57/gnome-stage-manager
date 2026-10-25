// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

const FIRST_FRAME_GRACE_MS = 1500;

export class WindowTracker {
    constructor(onChanged, onRemoved, onMinimized) {
        this._onChanged = onChanged;
        this._onRemoved = onRemoved;
        this._onMinimized = onMinimized;
        this._windows = new Map();
        this._connections = [];
    }

    start() {
        this._connect(global.display, 'window-created', (_display, window) => this._track(window, true));
        this._connect(global.window_manager, 'map', (_wm, actor) => {
            this._watchFirstFrame(actor.meta_window, actor);
            this._onChanged();
        });
        this._connect(global.display, 'notify::focus-window', () => this._onChanged());
        this._connect(global.display, 'window-entered-monitor', () => this._onChanged());
        this._connect(global.display, 'window-left-monitor', () => this._onChanged());
        for (const actor of global.get_window_actors())
            this._track(actor.meta_window, false);
    }

    _connect(object, signal, callback) {
        this._connections.push([object, object.connect(signal, callback)]);
    }

    _track(window, newlyCreated) {
        if (this._windows.has(window))
            return;
        const state = {ids: [], awaitingFrame: newlyCreated, actor: null,
            frameSignal: 0, timeoutId: 0};
        this._windows.set(window, state);
        const ids = state.ids;
        const connect = (signal, callback) => ids.push(window.connect(signal, callback));
        if (newlyCreated)
            this._watchFirstFrame(window, window.get_compositor_private());
        for (const signal of ['workspace-changed', 'notify::title', 'notify::fullscreen',
            'notify::above', 'notify::on-all-workspaces', 'notify::skip-taskbar'])
            connect(signal, () => this._onChanged());
        connect('notify::minimized', () => {
            this._onMinimized(window);
            this._onChanged();
        });
        connect('unmanaged', () => {
            this._windows.delete(window);
            this._stopFrameWatch(state);
            for (const id of ids)
                window.disconnect(id);
            this._onRemoved(window);
            this._onChanged();
        });
        this._onChanged();
    }

    _watchFirstFrame(window, actor) {
        const state = this._windows.get(window);
        if (!state?.awaitingFrame || !actor || state.actor === actor)
            return;
        if (state.actor && state.frameSignal)
            state.actor.disconnect(state.frameSignal);
        state.actor = actor;
        state.frameSignal = actor.connect('first-frame', () => this._frameReady(window));
        if (!state.timeoutId) {
            state.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FIRST_FRAME_GRACE_MS, () => {
                state.timeoutId = 0;
                this._frameReady(window);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _frameReady(window) {
        const state = this._windows.get(window);
        if (!state?.awaitingFrame)
            return;
        state.awaitingFrame = false;
        this._stopFrameWatch(state);
        this._onChanged();
    }

    _stopFrameWatch(state) {
        if (state.actor && state.frameSignal)
            state.actor.disconnect(state.frameSignal);
        if (state.timeoutId)
            GLib.Source.remove(state.timeoutId);
        state.actor = null;
        state.frameSignal = 0;
        state.timeoutId = 0;
    }

    rootFor(window) {
        const seen = new Set();
        while (window && !seen.has(window)) {
            seen.add(window);
            const parent = window.get_transient_for();
            if (!parent)
                return window;
            window = parent;
        }
        return null;
    }

    get records() {
        return [...this._windows.keys()].filter(window =>
            window.get_window_type() === Meta.WindowType.NORMAL &&
            !window.get_transient_for() && !window.is_override_redirect() &&
            !window.skip_taskbar && !window.is_on_all_workspaces() &&
            !window.is_above() && window.can_minimize() && window.get_workspace()
        ).map(window => ({
            id: window.get_stable_sequence(),
            window,
            workspace: window.get_workspace().index(),
            monitor: window.get_monitor(),
            minimized: window.minimized,
            awaitingFrame: this._windows.get(window).awaitingFrame,
        }));
    }

    familyFor(root) {
        return [...this._windows.keys()].filter(window => this.rootFor(window) === root);
    }

    destroy() {
        for (const [object, id] of this._connections)
            object.disconnect(id);
        this._connections = [];
        for (const [window, state] of this._windows) {
            this._stopFrameWatch(state);
            for (const id of state.ids)
                window.disconnect(id);
        }
        this._windows.clear();
        this._onChanged = null;
        this._onRemoved = null;
        this._onMinimized = null;
    }
}
