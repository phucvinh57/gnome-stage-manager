import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import {StagePreview} from './stagePreview.js';
import {stageGeometry} from './stageGeometry.js';
import {supportsReducedMotion} from './shellCompat.js';

// Transparent breathing room for the tilted previews and focus outline.
const HORIZONTAL_CHROME = 32;

/** Shell-only view; the controller owns overview/fullscreen visibility policy.
 * update(records, activeId): ordered {id, window: Meta.Window} records; IDs are
 * opaque/stable. Active cards are retained but hidden for pre-minimize capture.
 * Surviving cards are never reparented.
 * setVisible(bool): desired visibility, additionally gated by a primary monitor
 * and at least one inactive card. Initially hidden. Does not manipulate windows.
 */
export class StageStrip {
    constructor(settings, onActivate) {
        this._settings = settings;
        this._onActivate = onActivate;
        this._cards = new Map();
        this._pendingAdded = new Set();
        this._signals = [];
        this._visible = false;
        this._inactiveCount = 0;
        this._destroyed = false;
        this._hasWorkArea = false;
        this._stSettings = St.Settings.get();
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this._previewWidth = 0;
        const shellMajor = Number.parseInt(Config.PACKAGE_VERSION, 10);
        this._list = new St.BoxLayout({
            style_class: 'stage-manager-list',
            ...(shellMajor >= 48
                ? {orientation: Clutter.Orientation.VERTICAL}
                : {vertical: true}),
            x_expand: true,
        });
        this.actor = new St.ScrollView({
            style_class: 'stage-manager-strip',
            overlay_scrollbars: true,
            visible: false,
            clip_to_allocation: true,
            child: this._list,
        });
        this.actor.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        Main.layoutManager.addChrome(this.actor, {
            affectsStruts: false,
            trackFullscreen: false,
        });
        // Makes the cards reachable via Ctrl+Alt+Tab, then standard Tab/arrows;
        // St.Button provides keyboard activation (Space/Enter) and AT roles.
        Main.ctrlAltTabManager.addGroup(this.actor, 'Stage Manager',
            'view-grid-symbolic');
        this._connect(settings, 'changed::preview-width', () => this._layout());
        this._connect(this._themeContext, 'notify::scale-factor', () => {
            this._previewWidth = 0;
            this._layout();
        });
        this._connect(settings, 'changed::strip-edge', () => this._layout());
        this._connect(settings, 'changed::window-padding', () => this._layout());
        this._connect(settings, 'changed::strip-gap', () => this._layout());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._layout());
        this._connect(global.display, 'workareas-changed', () => this._layout());
        this._connect(global.window_manager, 'map', (_wm, actor) => {
            for (const card of this._cards.values()) {
                if (card.window === actor.meta_window)
                    card.refresh();
            }
        });
        this._connect(this.actor, 'notify::mapped', () => {
            if (this.actor.mapped) {
                for (const card of this._cards.values())
                    card.refresh();
            }
        });
        // If accessibility settings change during a fade, finish immediately.
        const finishAnimations = () => {
            if (this._animationDuration() === 0) {
                for (const card of this._cards.values()) {
                    card.actor.remove_all_transitions();
                    card.actor.opacity = 255;
                }
            }
        };
        this._connect(this._stSettings, 'notify::enable-animations', finishAnimations);
        if (supportsReducedMotion(this._stSettings))
            this._connect(this._stSettings, 'notify::reduced-motion', finishAnimations);
        this._connect(settings, 'changed::animation-duration', finishAnimations);
        this._layout();
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _animationDuration() {
        if (!this._stSettings.enable_animations ||
            (St.ReducedMotion && this._stSettings.reduced_motion === St.ReducedMotion.REDUCE))
            return 0;
        return Math.max(0, this._settings.get_int('animation-duration'));
    }

    prepare(records) {
        this.update(records, null, true);
    }

    capture(window) {
        for (const card of this._cards.values()) {
            if (card.window === window)
                card.capture();
        }
    }

    update(records, activeId, preparing = false) {
        if (this._destroyed)
            return;
        const wanted = new Map();
        for (const record of records) {
            if (record && record.id != null &&
                record.window && !wanted.has(record.id))
                wanted.set(record.id, record);
        }
        const hadFocus = [...this._cards.values()].some(card => card.actor.has_key_focus());
        for (const [id, card] of this._cards) {
            if (!wanted.has(id) || wanted.get(id).window !== card.window) {
                this._pendingAdded.delete(card);
                card.destroy();
                this._cards.delete(id);
            }
        }
        let index = 0;
        for (const [id, record] of wanted) {
            let card = this._cards.get(id);
            if (!card) {
                card = new StagePreview(record, stageId => this._onActivate?.(stageId));
                this._cards.set(id, card);
                this._list.add_child(card.actor);
                card.actor.connect('key-focus-in', () => this._ensureVisible(card.actor));
                card.setPreviewWidth(Math.max(1, this._previewWidth - this._horizontalChrome()));
                this._pendingAdded.add(card);
                if (preparing)
                    card.actor.visible = false;
            } else {
                card.refresh(record);
            }
            if (!preparing)
                card.actor.visible = id !== activeId && !record.awaitingFrame;
            // Reordering in-place preserves the actor, key focus and scroll offset.
            if (this._list.get_child_at_index(index) !== card.actor)
                this._list.set_child_at_index(card.actor, index);
            index++;
        }
        if (preparing)
            return;
        this._inactiveCount = records.filter(record =>
            record.id !== activeId && !record.awaitingFrame).length;
        this._layout();
        const duration = this._animationDuration();
        if (duration > 0 && this.actor.mapped) {
            for (const card of this._pendingAdded) {
                if (!card.actor.visible)
                    continue;
                card.actor.opacity = 0;
                card.actor.ease({opacity: 255, duration, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            }
        }
        this._pendingAdded.clear();
        // Only recover focus if its card disappeared; never grab focus on refresh.
        if (hadFocus && this.actor.visible &&
            ![...this._cards.values()].some(card => card.actor.has_key_focus()))
            [...this._cards.values()].find(card => card.actor.visible)?.actor.grab_key_focus();
    }

    _ensureVisible(actor) {
        const adjustment = this.actor.vadjustment;
        const box = actor.get_allocation_box();
        if (box.y1 < adjustment.value)
            adjustment.value = box.y1;
        else if (box.y2 > adjustment.value + adjustment.page_size)
            adjustment.value = Math.max(adjustment.lower, box.y2 - adjustment.page_size);
    }

    _horizontalChrome() {
        // St scales CSS padding; actor geometry is expressed in stage units.
        return HORIZONTAL_CHROME * this._themeContext.scale_factor;
    }

    _layout() {
        if (this._destroyed)
            return;
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor) {
            this._hasWorkArea = false;
            this._syncVisibility();
            return;
        }
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        this._hasWorkArea = area.width > 0 && area.height > 0;
        if (!this._hasWorkArea) {
            this._syncVisibility();
            return;
        }
        const geometry = stageGeometry(area, this._settings.get_string('strip-edge'),
            this._settings.get_int('preview-width'), this._settings.get_int('window-padding'),
            this._settings.get_int('strip-gap'));
        this._hasWorkArea = geometry.hasStrip;
        const width = Math.max(1, geometry.strip.width);
        if (width !== this._previewWidth) {
            this._previewWidth = width;
            for (const card of this._cards.values())
                card.setPreviewWidth(Math.max(1, width - this._horizontalChrome()));
        }
        this.actor.width = width;
        // Measure unconstrained natural height, then cap at the usable work area.
        // The list is StScrollable; excess cards scroll rather than shrink.
        this.actor.height = -1;
        const [, naturalHeight] = this.actor.get_preferred_height(width);
        const height = Math.max(1, Math.min(naturalHeight, geometry.strip.height));
        this.actor.height = height;
        this.actor.set_position(geometry.strip.x,
            Math.round(geometry.strip.y + (geometry.strip.height - height) / 2));
        this._syncVisibility();
    }

    setVisible(visible) {
        if (this._destroyed)
            return;
        this._visible = Boolean(visible);
        this._syncVisibility();
    }

    _syncVisibility() {
        // Immediate hide also immediately drops the chrome input region. The
        // controller must call setVisible(false) for overview/fullscreen/disable.
        const visible = this._visible && this._hasWorkArea && this._inactiveCount > 0;
        if (!visible) {
            for (const card of this._cards.values()) {
                card.actor.remove_all_transitions();
                card.actor.opacity = 255;
            }
        }
        this.actor.visible = visible;
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
        for (const card of this._cards.values())
            card.destroy();
        this._cards.clear();
        this._pendingAdded.clear();
        Main.layoutManager.removeChrome(this.actor);
        // ctrlAltTabManager removes its group on the actor's destroy signal.
        this.actor.destroy();
        this.actor = null;
        this._list = null;
        this._settings = null;
        this._stSettings = null;
        this._themeContext = null;
        this._onActivate = null;
    }
}
