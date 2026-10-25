// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Meta from 'gi://Meta';

export class WindowTracker {
    constructor(onChanged, onRemoved, onMinimized) {
        this._onChanged = onChanged;
        this._onRemoved = onRemoved;
        this._onMinimized = onMinimized;
        this._windows = new Map();
        this._connections = [];
    }

    start() {
        this._connect(global.display, 'window-created', (_display, window) => this._track(window));
        this._connect(global.window_manager, 'map', () => this._onChanged());
        this._connect(global.display, 'notify::focus-window', () => this._onChanged());
        this._connect(global.display, 'window-entered-monitor', () => this._onChanged());
        this._connect(global.display, 'window-left-monitor', () => this._onChanged());
        for (const actor of global.get_window_actors())
            this._track(actor.meta_window);
    }

    _connect(object, signal, callback) {
        this._connections.push([object, object.connect(signal, callback)]);
    }

    _track(window) {
        if (this._windows.has(window))
            return;
        const ids = [];
        this._windows.set(window, ids);
        const connect = (signal, callback) => ids.push(window.connect(signal, callback));
        for (const signal of ['workspace-changed', 'notify::title', 'notify::fullscreen',
            'notify::above', 'notify::on-all-workspaces', 'notify::skip-taskbar'])
            connect(signal, () => this._onChanged());
        connect('notify::minimized', () => {
            this._onMinimized(window);
            this._onChanged();
        });
        connect('unmanaged', () => {
            this._windows.delete(window);
            for (const id of ids)
                window.disconnect(id);
            this._onRemoved(window);
            this._onChanged();
        });
        this._onChanged();
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
        }));
    }

    familyFor(root) {
        return [...this._windows.keys()].filter(window => this.rootFor(window) === root);
    }

    destroy() {
        for (const [object, id] of this._connections)
            object.disconnect(id);
        this._connections = [];
        for (const [window, ids] of this._windows) {
            for (const id of ids)
                window.disconnect(id);
        }
        this._windows.clear();
        this._onChanged = null;
        this._onRemoved = null;
        this._onMinimized = null;
    }
}
