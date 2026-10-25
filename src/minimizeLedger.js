/**
 * Tracks only minimizations performed here, never ones performed by the user.
 * Window methods are synchronous and may synchronously emit minimized changes.
 * Errors propagate, but failed operations never retain ownership of a window.
 */
export class MinimizeLedger {
    constructor() {
        this._owned = new Set();
    }

    get windows() {
        return [...this._owned];
    }

    has(window) {
        return this._owned.has(window);
    }

    minimize(window) {
        if (window.minimized)
            return false;

        // notify::minimized can run inside minimize().
        this._owned.add(window);
        try {
            window.minimize();
            return true;
        } catch (error) {
            this._owned.delete(window);
            throw error;
        }
    }

    restore(window) {
        // Release before accessing the window or emitting any synchronous events.
        if (!this._owned.delete(window))
            return false;

        if (!window.minimized)
            return false;

        window.unminimize();
        return true;
    }

    restoreAll() {
        // Use a snapshot: restoring may synchronously change ledger membership.
        // A disposed window must not prevent the remaining windows restoring.
        const errors = [];
        for (const window of this.windows) {
            try {
                this.restore(window);
            } catch (error) {
                errors.push(error);
            }
        }
        if (errors.length === 1)
            throw errors[0];
        if (errors.length > 1)
            throw new AggregateError(errors, 'Failed to restore minimized windows');
    }

    forget(window) {
        return this._owned.delete(window);
    }

    observe(window) {
        if (this._owned.has(window) && !window.minimized)
            this._owned.delete(window);
    }
}
