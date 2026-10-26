# Install Stage Manager locally

Stage Manager is experimental. It targets GNOME Shell 46–51 on Wayland; runtime compatibility across every listed version has not been verified.

## Requirements

- GNOME Shell with the `gnome-extensions` command
- Node.js and npm
- GLib’s `glib-compile-schemas` command

## Build and install

From the repository root:

```sh
npm install
npm run check
npm test
npm run pack
```

`npm run pack` builds the ZIP in `dist/` and installs it for your user. It does not enable or publish the extension. To build without installing, run `bash scripts/package.sh` instead.

On Wayland, **log out and log back in** after installing or updating. Toggling the extension does not reliably reload its JavaScript.

## Enable and start

Enable **Stage Manager** in the Extensions app, or run:

```sh
gnome-extensions enable stage-manager@phucvinh57
```

Then turn on Stage Manager using its top-bar menu or **Super + Shift + Space**. A fresh installation starts with stage management off; existing preferences survive updates.

Open Preferences from the menu, or run:

```sh
gnome-extensions prefs stage-manager@phucvinh57
```

## Disable

Turn off the top-bar switch to stop arranging windows, or disable the extension entirely:

```sh
gnome-extensions disable stage-manager@phucvinh57
```

Windows minimized by the extension are restored. Their original size and position are not restored. If the desktop is unresponsive, follow the [recovery instructions](technical-guide.md#safety-and-recovery).

See the [technical guide](technical-guide.md) for settings, limitations, and troubleshooting.
