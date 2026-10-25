// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Graphene from 'gi://Graphene';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {previewTransform, snapshotSize} from './previewGeometry.js';

// Mutter capture is native-resolution; downsample on the GPU before caching.
// Bound the temporary input independently from retained thumbnail textures.
// Logical accounting only: native/GJS references can outlive their wrappers;
// compositor/driver overhead and delayed release are additional.
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
const SNAPSHOT_BUDGET = 16 * 1024 * 1024;
const MAX_SNAPSHOTS = 20;
const snapshots = new Map(); // insertion order: oldest successful capture first
let snapshotBytes = 0;

/** Focus-preserving card with an optional in-memory last-visible snapshot.
 * Call capture() BEFORE minimizing a window, including the active stage. Hidden
 * windows are never unminimized, read back, or written to disk for thumbnails.
 */
export class StagePreview {
    constructor(record, onActivate) {
        this.id = record.id;
        this._window = record.window;
        this._awaitingFrame = Boolean(record.awaitingFrame);
        this._onActivate = onActivate;
        this._windowSignals = [];
        this._sourceSignals = [];
        this._source = null;
        this._clone = null;
        this._snapshot = null;
        this._snapshotWidth = 0;
        this._snapshotHeight = 0;
        this._width = 160;
        this._height = 90;

        this.actor = new St.Button({
            style_class: 'stage-manager-card',
            can_focus: true,
            reactive: true,
            track_hover: true,
            x_expand: true,
        });
        // A transparent hit target surrounds the window itself, not a card.
        const box = new St.Widget({layout_manager: new Clutter.BinLayout()});
        this.actor.set_child(box);
        this._thumbnail = new St.Widget({
            style_class: 'stage-manager-thumbnail',
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: false,
            x_expand: true,
        });
        // Explicit perspective rather than a Y/Z rotation: both vertical edges
        // stay upright, with the right edge shorter, as in the sidebar sketch.
        this._thumbnail.set_pivot_point(0, 0);
        box.add_child(this._thumbnail);
        this._icon = new St.Icon({
            style_class: 'stage-manager-app-badge',
            icon_size: 24,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END,
        });
        box.add_child(this._icon);
        this._fallback = new St.Icon({
            icon_size: 48,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._thumbnail.add_child(this._fallback);
        this.actor.connect('clicked', () => this._onActivate?.(this.id));
        this.actor.connect('destroy', () => this._dispose());
        this._windowSignals.push(this._window.connect('notify::minimized', () => this._syncThumbnail()));
        this._windowSignals.push(this._window.connect('notify::title', () => this._updateTitle()));
        this._windowSignals.push(this._window.connect('notify::wm-class', () => this._updateTitle()));
        this._windowSignals.push(this._window.connect('unmanaged', () => {
            this._detachSource();
            this._clearSnapshot();
            this._syncThumbnail();
            this._disconnectWindow();
            this.actor.reactive = false;
            this.actor.can_focus = false;
            this._onActivate = null;
        }));
        this._updateTitle();
        this.refresh();
    }

    get window() {
        return this._window;
    }

    _updateTitle() {
        if (!this._window)
            return;
        const app = Shell.WindowTracker.get_default().get_window_app(this._window);
        const appName = app?.get_name() || this._window.get_wm_class() || 'Window';
        const title = this._window.get_title() || appName;
        this.actor.accessible_name = title === appName ? title : `${title} — ${appName}`;
        // Icons, not Shell.App objects, are retained by the card.
        const gicon = app?.get_app_info()?.get_icon() ?? null;
        for (const icon of [this._icon, this._fallback]) {
            if (gicon)
                icon.gicon = gicon;
            else
                icon.icon_name = 'application-x-executable-symbolic';
        }
    }

    setPreviewWidth(width) {
        this._width = Math.max(1, width);
        this._syncThumbnail();
    }

    /** Retry after controller refresh/map; no clone before an actor exists. */
    refresh(record = null) {
        if (!this.actor || !this._window)
            return;
        if (record)
            this._awaitingFrame = Boolean(record.awaitingFrame);
        const source = this._window.get_compositor_private();
        if (source !== this._source) {
            this._detachSource();
            if (source) {
                this._source = source;
                for (const signal of ['notify::width', 'notify::height', 'notify::visible'])
                    this._sourceSignals.push(source.connect(signal, () => this._syncThumbnail()));
                // Keep one safe last-visible image even if the user minimizes
                // the active window before the controller gets a capture chance.
                this._sourceSignals.push(source.connect('first-frame', () => {
                    this._awaitingFrame = false;
                    this.capture();
                }));
                this._sourceSignals.push(source.connect('destroy', () => this._detachSource()));
                // Already-mapped actors emitted first-frame before this card
                // existed. This is still visible-only and never restores users'
                // minimized windows. capture()->refresh() now sees this source.
                if (!this._awaitingFrame)
                    this.capture();
            }
        }
        this._syncThumbnail();
    }

    /** Returns true only for a new snapshot. Ineligible windows retain the last
     * snapshot, including on allocation failure. Replacement reserves enough
     * budget for both thumbnails until the replacement has been validated.
     * Native-resolution input is temporary and separately bounded to 64 MiB.
     * New Mutter uses paint_to_content_full() for an explicit RGBA8 format;
     * older Mutter uses paint_to_content(), whose default is RGBA8.
     */
    capture() {
        if (!this.actor || !this._window)
            return false;
        this.refresh();
        if (this._awaitingFrame)
            return false;
        const source = this._source;
        if (!this._isVisibleSource())
            return false;
        const scale = source.get_resource_scale?.() ?? 1;
        // Mutter allocates (int)(ceil(actor size) * resource_scale). Round up
        // conservatively; forcing RGBA8 avoids an unbounded HDR bytes/pixel.
        const width = Math.ceil(Math.ceil(source.width) * scale);
        const height = Math.ceil(Math.ceil(source.height) * scale);
        const captureBytes = width * height * 4;
        if (!Number.isFinite(captureBytes) || captureBytes <= 0 || captureBytes > MAX_CAPTURE_BYTES)
            return false;
        const size = snapshotSize(width, height);
        const bytes = size.width * size.height * 4;

        // Retain the last good capture if Mutter has no surface yet or painting
        // fails. Reserve the temporary replacement allocation, evicting other
        // cards only. This limits accounted bytes, not delayed native release.
        // Evictions are not rolled back if the subsequent capture fails.
        while (snapshots.size + (snapshots.has(this) ? 0 : 1) > MAX_SNAPSHOTS ||
            snapshotBytes + bytes > SNAPSHOT_BUDGET) {
            const oldest = [...snapshots.keys()].find(card => card !== this);
            if (!oldest)
                return false;
            oldest._clearSnapshot();
            oldest._syncThumbnail();
        }
        try {
            const nativeContent = source.paint_to_content_full
                ? source.paint_to_content_full(null, Cogl.PixelFormat.RGBA_8888_PRE, null)
                : source.paint_to_content?.(null);
            if (!nativeContent) {
                this._syncThumbnail();
                return false;
            }
            const [hasSize, contentWidth, contentHeight] = nativeContent.get_preferred_size();
            if (!hasSize || contentWidth <= 0 || contentHeight <= 0)
                return false;
            const content = downsample(nativeContent.get_texture(), size.width, size.height);
            this._clearSnapshot();
            this._snapshot = new Clutter.Actor({
                content,
                reactive: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._snapshotWidth = source.width;
            this._snapshotHeight = source.height;
            this._thumbnail.add_child(this._snapshot);
            snapshots.set(this, bytes);
            snapshotBytes += bytes;
        } catch (_error) {
            // A missing surface or a failed GPU allocation must not break stages.
            this._syncThumbnail();
            return false;
        }
        this._syncThumbnail();
        return true;
    }

    _isVisibleSource() {
        const source = this._source;
        return this._window && !this._window.minimized && source && source.visible &&
            source.width > 0 && source.height > 0;
    }

    _syncThumbnail() {
        if (!this.actor)
            return;
        const source = this._source;
        // Match each window's aspect ratio instead of a fixed black 16:9 tile.
        const width = this._isVisibleSource() ? source.width : this._snapshotWidth;
        const height = this._isVisibleSource() ? source.height : this._snapshotHeight;
        const ratio = width > 0 && height > 0 ? height / width : 9 / 16;
        this._height = Math.max(1, Math.round(this._width * Math.min(1.4, ratio)));
        this._thumbnail.height = this._height;
        this._thumbnail.width = this._width;
        const transform = new Graphene.Matrix();
        transform.init_from_float(previewTransform(this._width, this._height));
        this._thumbnail.set_transform(transform);
        if (!this._isVisibleSource()) {
            this._clearClone();
            if (this._snapshot) {
                this._fit(this._snapshot, this._snapshotWidth, this._snapshotHeight);
                this._snapshot.show();
                this._fallback.hide();
                this._icon.show();
            } else {
                this._fallback.show();
                this._icon.hide();
            }
            return;
        }
        this._snapshot?.hide();
        if (!this._clone) {
            this._clone = new Clutter.Clone({
                source,
                reactive: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._thumbnail.add_child(this._clone);
        }
        this._fit(this._clone, source.width, source.height);
        this._fallback.hide();
        this._icon.show();
    }

    _fit(actor, width, height) {
        const scale = Math.min(this._width / width, this._height / height);
        actor.set_size(Math.max(1, Math.floor(width * scale)),
            Math.max(1, Math.floor(height * scale)));
    }

    _clearSnapshot() {
        snapshotBytes -= snapshots.get(this) ?? 0;
        snapshots.delete(this);
        if (this._snapshot) {
            this._snapshot.content = null;
            this._snapshot.destroy();
            this._snapshot = null;
        }
        this._snapshotWidth = 0;
        this._snapshotHeight = 0;
    }

    _clearClone() {
        if (!this._clone)
            return;
        this._clone.set_source(null);
        this._clone.destroy();
        this._clone = null;
    }

    _detachSource() {
        this._clearClone();
        if (this._source) {
            for (const id of this._sourceSignals)
                this._source.disconnect(id);
        }
        this._sourceSignals = [];
        this._source = null;
        this._syncThumbnail();
    }

    _disconnectWindow() {
        if (this._window) {
            for (const id of this._windowSignals)
                this._window.disconnect(id);
        }
        this._windowSignals = [];
        this._window = null;
    }

    _dispose() {
        if (!this.actor)
            return;
        this.actor = null;
        this._detachSource();
        this._clearSnapshot();
        this._disconnectWindow();
        this._onActivate = null;
        this.id = null;
    }

    destroy() {
        this.actor?.destroy();
    }
}

/** GPU-only resampling: no CPU readback, codec, disk, or app re-render request.
 * The returned content owns only the small texture, not the full-size input.
 */
function downsample(input, width, height) {
    const context = input.get_context();
    const texture = Cogl.Texture2D.new_with_size(context, width, height);
    texture.set_auto_mipmap(false);
    const framebuffer = Cogl.Offscreen.new_with_texture(texture);
    framebuffer.allocate();
    framebuffer.orthographic(0, 0, width, height, -1, 1);
    const pipeline = Cogl.Pipeline.new(context);
    pipeline.set_layer_texture(0, input);
    pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR, Cogl.PipelineFilter.LINEAR);
    // Replace rather than blend: preserve the source's premultiplied alpha.
    pipeline.set_blend('RGBA = ADD (SRC_COLOR, 0)');
    framebuffer.draw_textured_rectangle(pipeline, 0, 0, width, height, 0, 0, 1, 1);
    framebuffer.flush();
    pipeline.remove_layer(0);
    return Clutter.TextureContent.new_from_texture(texture, null);
}
