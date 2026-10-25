/**
 * Pure stage-selection state; deliberately independent of GNOME/GI.
 *
 * IDs and context values are opaque and compared by identity (Map / ===).
 * Call setContext(workspace, monitor) to select an exact context. Initially
 * there is no context. setWindows() replaces the complete, global snapshot;
 * records need a non-null id. Duplicate IDs use the first record. Records are
 * shallow-copied; caller order is used for newly discovered windows only.
 *
 * windows: all records in the current context, including minimized windows,
 * in stable discovery order. orderedWindows: the same records, MRU first,
 * followed by never-selected records in discovery order. Both return fresh
 * arrays and shallow copies, so callers cannot mutate internal records.
 *
 * Only non-minimized windows may be active or cycled to. A controller that
 * minimizes inactive windows itself must report those as minimized: false.
 * An eligible active window survives snapshot/context updates. Otherwise the
 * most recently selected eligible window wins, then the first eligible window
 * in discovery order. With no eligible windows, activeId is null.
 *
 * activate(id) returns true for an eligible current-context ID (including an
 * already-active ID), false otherwise. remove(id) returns whether it existed.
 * nextId(direction = 1) is a method, not a getter: it does not mutate state.
 * Positive/negative directions move one step forward/backward in stable
 * discovery order, NOT MRU order; zero returns activeId. With no active window
 * it returns the first/last eligible ID, or null if none exist.
 */
export class StageModel {
    constructor() {
        this._records = new Map();
        this._mru = [];
        this._activeId = null;
        this._hasContext = false;
        this._workspace = undefined;
        this._monitor = undefined;
    }

    setWindows(records) {
        const incoming = new Map();
        for (const record of records) {
            if (record == null || record.id == null || incoming.has(record.id))
                continue;
            incoming.set(record.id, {...record});
        }

        // A compositor may reorder a snapshot after each focus change. Retain
        // surviving IDs' discovery order so repeated cycling still progresses.
        const next = new Map();
        for (const id of this._records.keys()) {
            if (incoming.has(id))
                next.set(id, incoming.get(id));
        }
        for (const [id, record] of incoming) {
            if (!next.has(id))
                next.set(id, record);
        }
        this._records = next;
        this._mru = this._mru.filter(id => next.has(id));
        this._reconcile();
    }

    setContext(workspace, monitor) {
        this._workspace = workspace;
        this._monitor = monitor;
        this._hasContext = true;
        this._reconcile();
    }

    get windows() {
        return this._contextRecords().map(record => ({...record}));
    }

    get orderedWindows() {
        const records = new Map(this._contextRecords().map(record => [record.id, record]));
        const ordered = [];
        for (const id of this._mru) {
            if (records.has(id)) {
                ordered.push({...records.get(id)});
                records.delete(id);
            }
        }
        for (const record of records.values())
            ordered.push({...record});
        return ordered;
    }

    get activeId() {
        return this._activeId;
    }

    activate(id) {
        if (!this._isEligible(this._records.get(id)))
            return false;
        this._select(id);
        return true;
    }

    remove(id) {
        if (!this._records.has(id))
            return false;
        this.setWindows([...this._records.values()].filter(record => record.id !== id));
        return true;
    }

    nextId(direction = 1) {
        const ids = this._contextRecords()
            .filter(record => !record.minimized)
            .map(record => record.id);
        if (ids.length === 0)
            return null;
        if (direction === 0)
            return this._activeId;
        const step = direction < 0 ? -1 : 1;
        const current = ids.indexOf(this._activeId);
        if (current < 0)
            return step > 0 ? ids[0] : ids[ids.length - 1];
        return ids[(current + step + ids.length) % ids.length];
    }

    _inContext(record) {
        return this._hasContext && record !== undefined &&
            record.workspace === this._workspace && record.monitor === this._monitor;
    }

    _isEligible(record) {
        return this._inContext(record) && !record.minimized;
    }

    _contextRecords() {
        return [...this._records.values()].filter(record => this._inContext(record));
    }

    _select(id) {
        this._activeId = id;
        this._mru = [id, ...this._mru.filter(previous => previous !== id)];
    }

    _reconcile() {
        if (this._isEligible(this._records.get(this._activeId)))
            return;
        const recent = this._mru.find(id => this._isEligible(this._records.get(id)));
        const fallback = recent !== undefined
            ? this._records.get(recent)
            : this._contextRecords().find(record => !record.minimized);
        if (fallback)
            this._select(fallback.id);
        else
            this._activeId = null;
    }
}
