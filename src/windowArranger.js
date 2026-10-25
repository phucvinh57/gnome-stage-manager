import GLib from 'gi://GLib';
const RESIZE_SETTLE_MS = 300;

function sameRect(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function copyRect(rect) {
    return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
}

export class WindowArranger {
    constructor(onChanged) {
        this._onChanged = onChanged;
        this._states = new Map();
        this._grabbed = new Set();
        this._signals = [
            global.display.connect('grab-op-begin', (_display, window) => {
                this._grabbed.add(window);
            }),
            global.display.connect('grab-op-end', (_display, window) => {
                this._grabbed.delete(window);
                const state = this._states.get(window);
                if (state?.timeoutId)
                    state.retryAfterPending = true;
                if (state)
                    this._changed(window);
            }),
        ];
    }

    sync(records, target) {
        const wanted = new Set(records.map(record => record.window));
        for (const window of this._states.keys()) {
            if (!wanted.has(window))
                this._release(window, window.get_monitor() !== this._states.get(window).monitor);
        }
        if (!target)
            return;
        for (const {window} of records)
            this._arrange(window, target);
    }

    _arrange(window, target) {
        if (window.is_fullscreen() || this._grabbed.has(window))
            return;
        let state = this._states.get(window);
        if (!state) {
            state = {
                original: copyRect(window.get_frame_rect()),
                maximized: window.get_maximize_flags(),
                monitor: window.get_monitor(),
                signals: [],
                timeoutId: 0,
                requested: null,
                settled: null,
                constrained: false,
                retryAfterPending: false,
                sawTarget: false,
                maxAttempts: 0,
            };
            this._states.set(window, state);
            for (const signal of ['position-changed', 'size-changed',
                'notify::maximized-horizontally', 'notify::maximized-vertically'])
                state.signals.push(window.connect(signal, () => this._changed(window)));
            state.signals.push(window.connect('notify::fullscreen', () => {
                this._cancelTimeout(state);
                state.requested = null;
                state.constrained = false;
                state.maxAttempts = 0;
                this._onChanged();
            }));
        }
        const key = `${target.x},${target.y},${target.width},${target.height}`;
        if (state.key !== key) {
            state.key = key;
            state.requested = null;
            state.settled = null;
            state.constrained = false;
            state.retryAfterPending = false;
            state.sawTarget = false;
            state.maxAttempts = 0;
            state.target = {...target};
            this._cancelTimeout(state);
        }
        if (state.constrained && window.get_maximize_flags() && state.maxAttempts < 2) {
            // Mutter can finish maximizing after the previous resize settles.
            state.constrained = false;
            state.requested = null;
        }
        if (window.get_maximize_flags() && state.maxAttempts >= 2 && !state.timeoutId) {
            state.constrained = true;
            return;
        }
        if (state.timeoutId || state.constrained ||
            (window.get_maximize_flags() === 0 && sameRect(window.get_frame_rect(), target)))
            return;
        if (state.requested === key)
            return;
        const wasMaximized = window.get_maximize_flags() !== 0;
        if ((!window.allows_resize() || !window.allows_move()) && !wasMaximized) {
            state.constrained = true;
            return;
        }
        state.requested = key;
        state.constrained = false;
        state.retryAfterPending = false;
        state.sawTarget = sameRect(window.get_frame_rect(), target);
        state.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RESIZE_SETTLE_MS, () => {
            state.timeoutId = 0;
            state.settled = copyRect(window.get_frame_rect());
            if (window.get_maximize_flags() || state.retryAfterPending) {
                // A user action during the pending client resize is a new
                // request, rather than evidence of a size-constrained client.
                state.requested = null;
                state.constrained = false;
            } else {
                state.constrained = !sameRect(state.settled, target);
                if (!state.constrained)
                    state.maxAttempts = 0;
            }
            this._onChanged();
            return GLib.SOURCE_REMOVE;
        });
        if (wasMaximized) {
            state.maxAttempts++;
            window.unmaximize();
        }
        window.move_resize_frame(false, target.x, target.y, target.width, target.height);
        this._onChanged();
    }

    _changed(window) {
        const state = this._states.get(window);
        if (!state)
            return;
        if (state.timeoutId) {
            const atTarget = sameRect(window.get_frame_rect(), state.target);
            if (atTarget)
                state.sawTarget = true;
            else if (state.sawTarget)
                state.retryAfterPending = true;
            return;
        }
        if (this._grabbed.has(window) || window.is_fullscreen())
            return;
        const current = copyRect(window.get_frame_rect());
        if (state.constrained && state.settled && sameRect(current, state.settled) &&
            window.get_maximize_flags() === 0)
            return;
        state.requested = null;
        state.constrained = false;
        this._onChanged();
    }

    canShowStrip(window) {
        const state = this._states.get(window);
        return !state || (!state.timeoutId && !state.constrained && !this._grabbed.has(window));
    }

    isPending(window) {
        return Boolean(this._states.get(window)?.timeoutId);
    }

    _cancelTimeout(state) {
        if (state.timeoutId)
            GLib.Source.remove(state.timeoutId);
        state.timeoutId = 0;
    }

    _release(window, movedMonitor = null) {
        const state = this._states.get(window);
        if (!state)
            return;
        movedMonitor ??= window.get_monitor() !== state.monitor;
        this._states.delete(window);
        this._cancelTimeout(state);
        for (const id of state.signals)
            window.disconnect(id);
        this._grabbed.delete(window);
        if (movedMonitor)
            return;
        const wasFullscreen = window.is_fullscreen();
        const restoreFrame = () => {
            if (!window.get_workspace())
                return;
            if (window.get_maximize_flags())
                window.unmaximize();
            window.move_resize_frame(false, state.original.x, state.original.y,
                state.original.width, state.original.height);
            if (state.maximized)
                window.set_maximize_flags(state.maximized);
        };
        if (!wasFullscreen) {
            restoreFrame();
            return;
        }
        // Mutter saves a pre-fullscreen rect when entering fullscreen. Let
        // its exit complete and the restored frame settle before reentering,
        // so a later user exit returns to the original frame.
        window.unmake_fullscreen();
        let exitChecks = 0;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (window.is_fullscreen() && exitChecks++ < 20)
                return GLib.SOURCE_CONTINUE;
            if (!window.get_workspace())
                return GLib.SOURCE_REMOVE;
            restoreFrame();
            let frameChecks = 0;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                if (!window.get_workspace())
                    return GLib.SOURCE_REMOVE;
                const settled = sameRect(window.get_frame_rect(), state.original) &&
                    window.get_maximize_flags() === state.maximized;
                if (!settled && frameChecks++ < 10)
                    return GLib.SOURCE_CONTINUE;
                window.make_fullscreen();
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    forget(window) {
        const state = this._states.get(window);
        if (!state)
            return;
        this._states.delete(window);
        this._cancelTimeout(state);
        for (const id of state.signals)
            window.disconnect(id);
        this._grabbed.delete(window);
    }

    restoreAll() {
        for (const window of this._states.keys())
            this._release(window);
    }

    destroy() {
        this.restoreAll();
        for (const id of this._signals)
            global.display.disconnect(id);
        this._signals = [];
        this._onChanged = null;
    }
}
