import GLib from 'gi://GLib';
import {maximizeFlags, unmaximizeWindow} from './shellCompat.js';
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

    // Retention follows eligibility on the primary monitor, across workspaces.
    // Leaving the active workspace must not discard settled resize state.
    retain(records) {
        const wanted = new Set(records.map(record => record.window));
        for (const window of this._states.keys()) {
            if (!wanted.has(window))
                this.forget(window);
        }
    }

    sync(records, target) {
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
                signals: [],
                timeoutId: 0,
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
                state.constrained = false;
                state.maxAttempts = 0;
                this._onChanged();
            }));
        }
        if (!state.target || !sameRect(state.target, target)) {
            state.settled = null;
            state.constrained = false;
            state.retryAfterPending = false;
            state.sawTarget = false;
            state.maxAttempts = 0;
            state.target = {...target};
            this._cancelTimeout(state);
        }
        if (state.constrained && maximizeFlags(window) && state.maxAttempts < 2) {
            // Mutter can finish maximizing after the previous resize settles.
            state.constrained = false;
        }
        if (maximizeFlags(window) && state.maxAttempts >= 2 && !state.timeoutId) {
            state.constrained = true;
            return;
        }
        if (state.timeoutId || state.constrained ||
            (maximizeFlags(window) === 0 && sameRect(window.get_frame_rect(), target)))
            return;
        const wasMaximized = maximizeFlags(window) !== 0;
        if ((!window.allows_resize() || !window.allows_move()) && !wasMaximized) {
            state.constrained = true;
            return;
        }
        state.constrained = false;
        state.retryAfterPending = false;
        state.sawTarget = sameRect(window.get_frame_rect(), target);
        state.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RESIZE_SETTLE_MS, () => {
            state.timeoutId = 0;
            state.settled = copyRect(window.get_frame_rect());
            if (maximizeFlags(window) || state.retryAfterPending) {
                // A user action during the pending client resize is a new
                // request, rather than evidence of a size-constrained client.
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
            unmaximizeWindow(window);
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
            maximizeFlags(window) === 0)
            return;
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

    releaseAll() {
        for (const window of this._states.keys())
            this.forget(window);
    }

    destroy() {
        this.releaseAll();
        for (const id of this._signals)
            global.display.disconnect(id);
        this._signals = [];
        this._grabbed.clear();
        this._onChanged = null;
    }
}
