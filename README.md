# Stage Manager for GNOME

**One window in focus. Everything else within reach.**

Stage Manager keeps your current window front and center, with previews of your other windows along the edge of the screen. Click a preview to switch tasks without a pile of overlapping windows.

<video controls width="960" src="docs/media/demo.mp4">
  Watch the <a href="docs/media/demo.mp4">live desktop demo</a>.
</video>

## What it does

- **Focus on one task.** Other windows move into a compact preview strip.
- **Switch with a click.** Select a preview, or cycle through windows with a keyboard shortcut.
- **Make it yours.** Put previews on the left or right and adjust their size, spacing, and corners in Preferences.
- **Keep workspaces separate.** Each workspace keeps its own selection. Stage Manager manages only your primary monitor.

Each window is a separate stage; multiwindow groups are not supported. Minimized windows may show a saved preview or an app icon.

## Get started

This is an **experimental extension for GNOME Shell 46–51 on Wayland**. Compatibility across all listed versions is still being tested.

1. Follow the [installation guide](docs/installation.md) to build and install it locally.
2. Log out and back in, then enable **Stage Manager** in the Extensions app.
3. Open its top-bar menu and turn on the Stage Manager switch. You can also press **Super + Shift + Space**.
4. Click a preview to bring that window into focus.

Stage Manager starts switched off on a fresh installation. Open **Preferences** from its menu to customize the layout and shortcuts.

## Keyboard shortcuts

| Action | Default shortcut |
| --- | --- |
| Turn Stage Manager on or off | Super + Shift + Space |
| Next window | Super + Shift + ] |
| Previous window | Super + Shift + [ |

Super is usually the Windows key. Shortcuts can be changed or cleared in Preferences.

## Turn it off

Use the top-bar switch or **Super + Shift + Space**. Windows minimized by Stage Manager return; windows you had already minimized stay minimized. Windows keep their current size and position.

For help, see [troubleshooting and recovery](docs/technical-guide.md#safety-and-recovery).

## More information

- [Installation](docs/installation.md)
- [Technical guide: behavior, settings, architecture, and troubleshooting](docs/technical-guide.md)
- [How it works with GNOME and Wayland](docs/wayland-sequence.md)
- [Live desktop demo (MP4)](docs/media/demo.mp4)

Parts of this personal-use project were generated with AI. It is not published on extensions.gnome.org. No project license has been declared; see the [project notes](docs/technical-guide.md#ai-personal-use-and-licensing) before redistributing.
