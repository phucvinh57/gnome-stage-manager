// GTK belongs only in this preferences process, never in the Shell UI modules.
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class StageManagerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // Keep the settings alive for the lifetime of the preferences window.
        window._settings = settings;
        const signals = [];
        const page = new Adw.PreferencesPage({
            title: 'Stage Manager',
            icon_name: 'preferences-desktop-display-symbolic',
        });
        window.add(page);

        const general = new Adw.PreferencesGroup({
            title: 'Stage Manager',
            description: 'Manages windows on the primary monitor and current workspace only. ' +
                'Each window is a separate stage; multiwindow grouping is not supported. ' +
                'Stage Manager starts switched off until you enable it.',
        });
        page.add(general);
        const enabled = new Adw.SwitchRow({
            title: 'Enable Stage Manager',
            subtitle: 'Arrange windows and show the preview strip',
        });
        general.add(enabled);
        settings.bind('stage-enabled', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);

        const appearance = new Adw.PreferencesGroup({title: 'Appearance'});
        page.add(appearance);
        const edges = ['left', 'right'];
        const edge = new Adw.ComboRow({
            title: 'Preview strip edge',
            model: Gtk.StringList.new(['Left', 'Right']),
            selected: edges.indexOf(settings.get_string('strip-edge')),
        });
        appearance.add(edge);
        edge.connect('notify::selected', () => {
            if (edge.selected < edges.length)
                settings.set_string('strip-edge', edges[edge.selected]);
        });
        signals.push(settings.connect('changed::strip-edge', () => {
            edge.selected = edges.indexOf(settings.get_string('strip-edge'));
        }));

        this._addSpinRow(appearance, settings, 'preview-width',
            'Preview width', 'Width in logical pixels', 100, 320, 10);
        this._addSpinRow(appearance, settings, 'animation-duration',
            'Animation duration', 'Milliseconds; set to 0 for no animation', 0, 400, 10);

        const shortcuts = new Adw.PreferencesGroup({
            title: 'Keyboard shortcuts',
            description: 'Enter one GTK accelerator per action, such as &lt;Super&gt;&lt;Shift&gt;space, ' +
                'then press Enter or the apply button. Clear the field to disable a shortcut. ' +
                'Invalid shortcuts are marked in red and are not saved.',
        });
        page.add(shortcuts);
        for (const [key, title] of [
            ['toggle-shortcut', 'Toggle Stage Manager'],
            ['next-shortcut', 'Next window'],
            ['previous-shortcut', 'Previous window'],
        ]) {
            this._addShortcutRow(shortcuts, settings, signals, key, title);
        }

        window.connect('close-request', () => {
            for (const id of signals)
                settings.disconnect(id);
            signals.length = 0;
            return false;
        });
    }

    _addSpinRow(group, settings, key, title, subtitle, lower, upper, step) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({
                lower,
                upper,
                step_increment: step,
                page_increment: step * 5,
            }),
            digits: 0,
            numeric: true,
            snap_to_ticks: false,
        });
        group.add(row);
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _addShortcutRow(group, settings, signals, key, title) {
        const row = new Adw.EntryRow({
            title,
            text: settings.get_strv(key)[0] ?? '',
            show_apply_button: true,
        });
        group.add(row);

        const parse = () => {
            const text = row.text.trim();
            if (!text)
                return {valid: true, accelerators: []};
            const [parsed, keyval, modifiers] = Gtk.accelerator_parse(text);
            const valid = parsed && Gtk.accelerator_valid(keyval, modifiers);
            return {
                valid,
                accelerators: valid ? [Gtk.accelerator_name(keyval, modifiers)] : [],
            };
        };
        const validate = () => {
            const result = parse();
            if (result.valid)
                row.remove_css_class('error');
            else
                row.add_css_class('error');
            row.tooltip_text = result.valid
                ? 'Press Enter or Apply to save. Leave empty to disable.'
                : 'Invalid GTK accelerator. Example: <Super><Shift>space';
            return result;
        };
        row.connect('changed', validate);
        row.connect('apply', () => {
            const {valid, accelerators} = validate();
            if (!valid)
                return;
            settings.set_strv(key, accelerators);
            row.text = accelerators[0] ?? '';
        });
        signals.push(settings.connect(`changed::${key}`, () => {
            row.text = settings.get_strv(key)[0] ?? '';
            validate();
        }));
        validate();
    }
}
