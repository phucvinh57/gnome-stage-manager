// Stable discovery order for cycling; selection history supplies fallbacks.
export class StageModel {
    constructor() {
        this._records = new Map();
        this._mru = [];
        this._activeId = null;
        this._context = null;
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
        this._context = {workspace, monitor};
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
        return this._context !== null && record !== undefined &&
            record.workspace === this._context.workspace && record.monitor === this._context.monitor;
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
