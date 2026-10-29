// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {StageController} from './src/stageController.js';
import {closeAllWindows} from './src/closeAll.js';

// Runs in unlock-dialog mode so locking does not tear down stages and their
// snapshots. The controller pauses while locked; only the indicator is removed.
export default class StageManagerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._controller = new StageController(this._settings);
        this._bindings = [];
        this._indicator = null;
        this._settingsId = 0;
        this._sessionId = 0;
        try {
            this._controller.start();
            this._settingsId = this._settings.connect('changed::stage-enabled', () => this._syncToggle());
            this._sessionId = Main.sessionMode.connect('updated', () => this._syncIndicator());
            this._syncIndicator();
            const actions = {
                'toggle-shortcut': () => this._settings.set_boolean('stage-enabled', !this._settings.get_boolean('stage-enabled')),
                'next-shortcut': () => this._controller.cycle(1),
                'previous-shortcut': () => this._controller.cycle(-1),
                'close-all-shortcut': () => closeAllWindows(
                    global.get_window_actors().map(actor => actor.meta_window),
                    Meta.WindowType.NORMAL, global.get_current_time()),
            };
            // NORMAL mode excludes the lock screen.
            for (const [name, action] of Object.entries(actions)) {
                Main.wm.addKeybinding(name, this._settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, action);
                this._bindings.push(name);
            }
        } catch (error) {
            this.disable();
            throw error;
        }
    }

    // Session mode unlock-dialog: metadata lists it so stages, window tracking,
    // and preview snapshots survive screen lock. Shell therefore does not call
    // disable() on lock; the controller pauses itself and _syncIndicator()
    // removes the panel indicator. disable() runs only on real disable/logout.
    disable() {
        for (const name of this._bindings ?? [])
            Main.wm.removeKeybinding(name);
        this._bindings = null;
        if (this._sessionId) {
            Main.sessionMode.disconnect(this._sessionId);
            this._sessionId = 0;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._removeIndicator();
        const controller = this._controller;
        this._controller = null;
        this._settings = null;
        if (controller)
            controller.destroy();
    }

    _syncIndicator() {
        // Shell keeps extension indicators on the lock screen; never expose
        // the toggle or Preferences there.
        if (Main.sessionMode.isLocked)
            this._removeIndicator();
        else if (!this._indicator)
            this._addIndicator();
    }

    _addIndicator() {
        this._indicator = new PanelMenu.Button(0, 'Stage Manager');
        this._indicator.add_style_class_name('stage-manager-indicator');
        this._indicator.add_child(new St.Icon({
            icon_name: 'focus-windows-symbolic',
            style_class: 'system-status-icon',
        }));
        this._toggleItem = new PopupMenu.PopupSwitchMenuItem(
            'Stage Manager', this._settings.get_boolean('stage-enabled'));
        this._toggleItem.connect('toggled', (_item, state) => this._settings.set_boolean('stage-enabled', state));
        this._indicator.menu.addMenuItem(this._toggleItem);
        this._indicator.menu.addAction('Preferences…', () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._syncToggle();
    }

    _removeIndicator() {
        if (this._indicator) {
            this._toggleItem?.destroy();
            this._indicator.destroy();
            this._indicator = null;
            this._toggleItem = null;
        }
    }

    _syncToggle() {
        if (!this._indicator)
            return;
        const enabled = this._settings.get_boolean('stage-enabled');
        this._toggleItem.setToggleState(enabled);
        this._indicator.accessible_name = `Stage Manager ${enabled ? 'on' : 'off'}`;
    }
}
