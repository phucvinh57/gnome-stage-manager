// Runs only as a child of the private headless Shell integration session.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

GLib.set_prgname('StageManagerFixture');
Gtk.init();
const loop = new GLib.MainLoop(null, false);
const root = new Gtk.Window({title: 'StageManagerFixture root', default_width: 400, default_height: 250});
const dialog = new Gtk.Window({title: 'StageManagerFixture dialog', transient_for: root,
    modal: true, default_width: 240, default_height: 140});
const fixed = new Gtk.Window({title: 'StageManagerFixture fixed', resizable: false,
    default_width: 400, default_height: 250});
const iface = `<node><interface name="org.gnome.StageManagerFixture">
    <method name="ShowDialog"/><method name="ShowFixed"/><method name="Quit"/>
</interface></node>`;
const exported = Gio.DBusExportedObject.wrapJSObject(iface, {
    ShowDialog() { dialog.present(); },
    ShowFixed() { fixed.present(); },
    Quit() { fixed.destroy(); dialog.destroy(); root.destroy(); loop.quit(); },
});
exported.export(Gio.DBus.session, '/org/gnome/StageManagerFixture');
const owner = Gio.bus_own_name_on_connection(Gio.DBus.session,
    'org.gnome.StageManagerFixture', Gio.BusNameOwnerFlags.NONE, null, null);
root.present();
loop.run();
exported.unexport();
Gio.bus_unown_name(owner);
