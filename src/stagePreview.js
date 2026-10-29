// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Graphene from 'gi://Graphene';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {previewTransform, snapshotSize} from './previewGeometry.js';
import {RoundedPreviewEffect} from './roundedPreviewEffect.js';
import {previewSourceIsStable} from './previewSource.js';

// Mutter capture is native-resolution; downsample on the GPU before caching.
// Bound the temporary input independently from retained thumbnail textures.
// Logical accounting only: native/GJS references can outlive their wrappers;
// compositor/driver overhead and delayed release are additional.
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
const SNAPSHOT_BUDGET = 16 * 1024 * 1024;
const MAX_SNAPSHOTS = 20;
const snapshots = new Map(); // insertion order: oldest successful capture first

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
        this._widthFactor = 0.9 + Math.random() * 0.1;
        this._edge = 'left';
        this._slope = 0;
        this._cornerRadius = 0;

        this.actor = new St.Button({
            style_class: 'stage-manager-card',
            can_focus: true,
            reactive: true,
            track_hover: true,
            x_expand: true,
        });
        // A transparent hit target surrounds the window itself, not a card.
        const box = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.START,
        });
        this._box = box;
        this.actor.set_child(box);
        // Keep the transform on an unclipped parent. The inner viewport crops
        // oversized window content in local coordinates before it is sheared.
        this._surface = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            // BinLayout uses actor alignment only on expanding axes. Otherwise
            // it centers the surface in the space reserved for the shear,
            // shifting its bottom corner beyond the card's scroll allocation.
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            clip_to_allocation: false,
        });
        this._surface.set_pivot_point(0, 0);
        box.add_child(this._surface);
        this._thumbnail = new St.Widget({
            style_class: 'stage-manager-thumbnail',
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
        });
        this._roundedEffect = new RoundedPreviewEffect();
        this._surface.add_effect(this._roundedEffect);
        // Shear only the window surface; the app badge stays upright.
        this._surface.add_child(this._thumbnail);
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
        this._syncThumbnail();
        this.refresh();
    }

    get window() {
        return this._window;
    }

    get previewHeight() {
        return this._thumbnail.height;
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
        width = Math.max(1, Math.round(width * this._widthFactor));
        if (width === this._width)
            return;
        this._width = width;
        this._syncThumbnail();
    }

    setPreviewEdge(edge) {
        if (edge === this._edge)
            return;
        this._edge = edge;
        this._box.x_align = edge === 'right'
            ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;
        this._syncThumbnail();
    }

    setPreviewSlope(slope) {
        if (slope === this._slope)
            return;
        this._slope = slope;
        this._syncThumbnail();
    }

    setCornerRadius(radius) {
        if (radius === this._cornerRadius)
            return;
        this._cornerRadius = radius;
        this._roundedEffect.update(this._width, this.previewHeight, radius);
    }

    refresh(record = null) {
        if (!this.actor || !this._window)
            return;
        const awaitingFrame = record ? Boolean(record.awaitingFrame) : this._awaitingFrame;
        const source = this._window.get_compositor_private();
        // Geometry, visibility and title changes have their own signals. A
        // different window opening must not repaint this unchanged thumbnail.
        if (source === this._source && awaitingFrame === this._awaitingFrame)
            return;
        this._awaitingFrame = awaitingFrame;
        if (source !== this._source) {
            this._detachSource();
            if (source) {
                this._source = source;
                for (const signal of ['notify::width', 'notify::height', 'notify::visible'])
                    this._sourceSignals.push(source.connect(signal, () => this._syncThumbnail()));
                this._sourceSignals.push(source.connect('transitions-completed', () => this.capture()));
                this._sourceSignals.push(source.connect('effects-completed', () => this.capture()));
                // Keep one safe last-visible image even if the user minimizes
                // the active window before the controller gets a capture chance.
                this._sourceSignals.push(source.connect('first-frame', () => {
                    this._awaitingFrame = false;
                    this.capture();
                }));
                this._sourceSignals.push(source.connect('destroy', () => this._detachSource()));
                // Already-mapped actors emitted first-frame before this card existed.
                if (!this._awaitingFrame)
                    this.capture();
            }
        }
        this._syncThumbnail();
    }

    // Returns true only for a new snapshot; failures keep the last one.
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
            [...snapshots.values()].reduce((total, size) => total + size, bytes) > SNAPSHOT_BUDGET) {
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
        return this._window && !this._window.minimized && previewSourceIsStable(source);
    }

    _syncThumbnail() {
        if (!this.actor)
            return;
        const source = this._source;
        const visible = this._isVisibleSource();
        this._thumbnail.height = Math.max(1, Math.round(this._width * 9 / 16));
        this._thumbnail.width = this._width;
        this._surface.set_size(this._width, this.previewHeight);
        this._roundedEffect.update(this._width, this.previewHeight, this._cornerRadius);
        // Transforms do not affect allocation: reserve the sheared bounds so
        // adjacent previews and the scroll view do not overlap or clip them.
        // Include a pixel on either side for fractional transformed edges.
        // Give the button an explicit height too: scroll extents must include
        // the last card's transformed corner, not just its inner viewport.
        const height = Math.ceil(this.previewHeight + Math.abs(this._slope) * this._width) + 2;
        this._box.set_size(this._width, height);
        this.actor.height = height;
        this._surface.translation_y = 1;
        const transform = new Graphene.Matrix();
        transform.init_from_float(previewTransform(this._width, this._slope));
        this._surface.set_transform(transform);
        if (!visible) {
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
        // Fill the common surface without stretching; clip excess at its edges.
        const scale = Math.max(this._width / width, this.previewHeight / height);
        actor.set_size(Math.max(1, Math.ceil(width * scale)),
            Math.max(1, Math.ceil(height * scale)));
    }

    _clearSnapshot() {
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
