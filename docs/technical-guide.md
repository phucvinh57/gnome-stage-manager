# Technical guide

An experimental, personal-use GNOME Shell extension that focuses on one window at a time and shows other windows in a preview strip. Extension UUID: `stage-manager@phucvinh57`.

**Status:** experimental implementation for GNOME Shell 46–51 on Wayland. Declaring versions in `metadata.json` does not guarantee runtime compatibility. GNOME 46–50, XWayland, and interactive desktop behavior still need runtime validation. The development environment is Ubuntu 26.10, GNOME Shell 51.0, Wayland, with a primary display of 3840×2400 at scale 2.

Future Ubuntu/GNOME releases need review before being added to `shell-version`.

## Behavior and scope

- Arranges eligible normal windows on the **primary monitor and current workspace**, retaining managed state on other workspaces. Other monitors are not stage-managed.
- Each top-level window is one stage; transient dialogs follow their parent rather than becoming separate stages. There are no persistent groups or multiwindow stage groups.
- Switching stages minimizes other eligible windows and restores the selected window family. Eligible top-level windows share one frame in the primary monitor's usable area. Workspace switches preserve those frames, inactive-stage minimizations, and workspace-local selection, avoiding a restore-and-resize cycle on return. Original frames and maximize states are not saved; stopping management leaves windows at their current geometry.
- The strip defaults to the **right** edge and excludes the active stage. It remains an overlay without a Shell strut. When only one eligible window exists on the current workspace and primary monitor, it fills the usable work area with window padding on all four sides. With multiple windows, managed frames reserve space for the strip. Preferences can move it to the left and adjust window padding and the strip gap.
- Clicking a card activates its window. Next/previous shortcuts cycle in stable window-discovery order, not MRU order. Cycling while Stage Manager is off turns it on.
- The strip hides in fullscreen. Overview pauses stage management and hides the strip while preserving managed geometry and minimizations; its native window picker still includes minimized windows. Selection and visibility are reconciled as Overview starts closing, and the strip returns after it closes. Lock/greeter modes suspend management and restore extension-owned minimizations; management resumes afterward when enabled.
- User drags and resizes are returned to the shared frame after the drag ends. The strip stays visible while a client resize settles, and hides during a user drag or when an application's size constraints prevent it from fitting. When a new stage opens, the previous window stays behind it until its first frame, map animation, and resize are ready. Windows moved to another monitor keep the user's placement there.
- Sticky, always-on-top, skip-taskbar, override-redirect, and non-minimizable windows are excluded from top-level stages.
- Inactive windows appear as frameless, slightly sheared previews with a small application badge. The visible stack fans smoothly from a downward slope at the top, through flat at the middle, to an upward slope at the bottom on the left strip; the right strip mirrors this. A single preview stays flat. Previews use a 16:9 crop with subtly rounded corners (configurable, including square corners), and vary randomly by up to 10% below the configured maximum width. Each card keeps its width variation until it is recreated; titles remain available to accessibility tools.
- Visible windows use live compositor clones. Newly opened inactive windows remain visible until their first compositor frame, then the extension captures that frame before minimizing them and showing a preview. A 1.5-second grace period after mapping prevents an unresponsive client from holding up stage management indefinitely. Windows already hidden use their last snapshot or a single application-icon fallback. Snapshots are never written to disk, and hidden windows are never restored just to capture them. Snapshots are downsampled on the GPU to at most 640×896 pixels (never upscaled, aspect ratio preserved), enough for the largest card at 2× density. The logical retained-cache budget is 16 MiB / 20 images; a 3840×2400 source becomes a 640×400 texture (~1 MiB rather than ~35 MiB). This is resolution reduction, not JPEG/PNG encoding: encoded images would still need decoded textures to display. Mutter's capture API first creates a native-resolution temporary image, limited to 64 MiB per capture. Native/GJS references may delay release; these budgets are not a hard GPU-memory ceiling, and compositor/driver overhead is additional. **Live thumbnails are not guaranteed** for minimized windows. This is not an exact reproduction of macOS visuals or behavior.

## Requirements and development commands

Use GNOME Shell 46–51 with its `gnome-extensions` CLI, Node.js/npm, and GLib's `glib-compile-schemas`. Preferences use GTK 4 and libadwaita in a separate process.

From the project root:

```sh
npm install
npm run check
npm run pack
```

- `npm run check`: ESLint and a strict schema dry-run. This does not validate GNOME Shell behavior.
- `npm run pack`: validates schemas and uses `gnome-extensions pack` to create `dist/stage-manager@phucvinh57.shell-extension.zip`, including `src/` and the root README along with standard extension files. The packaging script itself does not install or enable the extension. The current `npm run pack` command also installs the archive for the current user; it does not enable or publish it. `package.json` is also marked `private: true`.
## Local installation and first use

`npm run pack` builds and installs the archive. If you used `bash scripts/package.sh` to build only, install it for your user with:

```sh
gnome-extensions install --force dist/stage-manager@phucvinh57.shell-extension.zip
```

For installation into your **normal desktop session**, **log out and log back in**, then explicitly enable the extension. Disabling/re-enabling does not reliably reload updated JavaScript in the running Wayland Shell.

Enable after logging back in:

```sh
gnome-extensions enable stage-manager@phucvinh57
```

Enabling the extension installs its panel menu and shortcuts; stage management is separately opt-in. The schema default is **`stage-enabled=false`**. Open the Stage Manager panel icon and turn on its switch, or use the toggle shortcut. An existing saved setting can survive reinstalls; enabling the extension does not reset it to the default.

Open preferences from the panel menu, or:

```sh
gnome-extensions prefs stage-manager@phucvinh57
```

### Settings and shortcuts

Schema: `org.gnome.shell.extensions.stage-manager`, path `/org/gnome/shell/extensions/stage-manager/`.

| Key | Default | Meaning |
| --- | --- | --- |
| `stage-enabled` | `false` | Enable stage management independently of extension loading |
| `strip-edge` | `'right'` | `'left'` or `'right'` |
| `preview-width` | `180` | Logical pixels; range 100–320 |
| `preview-gap` | `8` | Vertical space between previews in theme-scaled pixels; range 0–128; updates immediately |
| `preview-corner-radius` | `6` | Window preview corner radius in theme-scaled pixels; range 0–32, 0 gives square corners; updates immediately |
| `window-padding` | `16` | Logical pixels above, below, and on the outer side of the managed window, or on all four sides for a lone window; range 0–128 |
| `strip-padding` | `16` | Sidebar inset from work area edges, independent of window padding; range 0–128 |
| `match-strip-spacing` | `true` | Match the sidebar-to-window gap to sidebar edge spacing |
| `strip-gap` | `16` | Custom logical pixel gap between window and strip when matching is off; range 0–128 |
| `animation-duration` | `160` | Milliseconds; range 0–400, 0 disables animation |
| `toggle-shortcut` | `['<Super><Shift>space']` | Toggle Stage Manager |
| `next-shortcut` | `['<Super><Shift>bracketright']` | Next eligible window |
| `previous-shortcut` | `['<Super><Shift>bracketleft']` | Previous eligible window |

For balanced spacing, leave **Match sidebar spacing** enabled and adjust **Sidebar edge spacing** (16 pixels by default). **Window padding** changes the active window’s top, bottom, and outer margin when the sidebar is reserved, and all four margins for a lone window. Disable matching to set a **Custom sidebar gap**. Spacing is measured from the strip allocation; previews include symmetric transparent room for focus outlines. On very small work areas, spacing is clamped to keep the window usable.

Shortcuts operate in normal Shell mode. Preferences accept one GTK accelerator per action; press Enter or Apply to save. Invalid entries are marked red and are not saved. Clearing a field saves an empty array and disables that shortcut. Layout-specific key availability and conflicts with other bindings need validation.

The strip is registered with Ctrl+Alt+Tab navigation; use standard Tab/arrows and Space/Enter for cards. New-card fades honor Shell animation/reduced-motion settings.

## Safety and recovery

The in-memory minimization ledger owns only minimizations performed by the extension, including windows on inactive workspaces. Turning Stage Manager off, or normally disabling the extension, restores owned minimizations while **preserving windows already minimized by the user**. Windows keep their current geometry and maximize state; no pre-extension layout is restored. Explicitly selecting a minimized card can restore that window. Independently user-minimized dialogs are intended to remain minimized.

An external restore of an extension-minimized window is treated as stage-selection intent, even if focus arrives after the restore notification. During Overview, that intent is retained until management resumes. Mutter/application transitions can still be ambiguous, especially with dialog coupling or competing extensions; validate native Alt+Tab and Ubuntu Dock paths before relying on them for work.

To stop the extension in a usable desktop terminal:

```sh
gnome-extensions disable stage-manager@phucvinh57
```

If the desktop UI is unusable, switch to a TTY (for example Ctrl+Alt+F3), log in **as the same desktop user**, and target that user's existing session bus:

```sh
uid=$(id -u)
XDG_RUNTIME_DIR="/run/user/$uid" \
DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" \
  gnome-extensions disable stage-manager@phucvinh57
```

This requires the user bus and Shell to still respond. Do not run it as root or create a new private bus for this recovery command. Return to your graphical session using its VT key, which varies by setup. **Do not kill or replace the live Shell**, especially on Wayland.

A Shell crash loses the in-memory ownership ledger. After recovery, windows left minimized may need to be restored manually through Overview or the dock; a later extension disable cannot reconstruct that ownership. There is no persistent group or recovery journal.

## Icon-only preview troubleshooting

- Preview captures wait for Shell's restore animations to finish, including after unlocking. Intermediate scaled or faded frames retain the previous snapshot instead of replacing it with a collapsed image.
- Open an affected window by clicking its preview, then switch to another stage. A window already minimized when capture began has no cached image; the extension never restores it merely to take a screenshot.
- Freshly opened windows get a chance to paint their first frame before the extension minimizes them. Until then their card is hidden; if no frame arrives within 1.5 seconds after mapping, the card can fall back to one centered app icon.
- A native 3840×2400 RGBA8 capture temporarily uses about 35 MiB, then is GPU-downsampled to a ~1 MiB cached thumbnail. Install the updated package and log out/in to reload JavaScript on Wayland.
- The 64 MiB temporary-input limit and 16 MiB retained-thumbnail budget remain finite. Very large windows, unavailable surfaces, failed GPU captures, or cache eviction can still show icons. Under cache pressure, eviction happens before capture and is not rolled back if capture fails. Disabling Stage Manager should restore only windows it minimized.

## Architecture

Paths in the table are relative to the repository root.

| File | Responsibility |
| --- | --- |
| `extension.js` | Extension lifecycle, panel switch, preferences action, keybindings |
| `src/stageController.js` | Context/focus coordination, minimization, suspension, lifecycle cleanup |
| `src/stageModel.js` | GI-independent selection, context, MRU fallback, stable cycling |
| `src/minimizeLedger.js` | In-memory minimization ownership and restoration |
| `src/windowTracker.js` | Window signals, eligibility, transient-family lookup |
| `src/stageStrip.js` | Shell overlay layout, scrolling, keyboard access, animation policy |
| `src/stageGeometry.js`, `src/windowArranger.js`, `src/shellCompat.js` | Shared work-area geometry, managed window frame lifecycle, and version-specific Mutter calls |
| `src/stagePreview.js` | Tilted window preview/app badge, accessible title, compositor clone, bounded in-memory snapshots, icon fallback, actor cleanup |
| `src/previewGeometry.js`, `src/previewSource.js`, `src/roundedPreviewEffect.js` | Preview transforms and snapshot sizing, stable-source checks, rounded preview rendering |
| `prefs.js` | Separate GTK 4/libadwaita preferences process; no GTK in Shell UI modules |
| `schemas/org.gnome.shell.extensions.stage-manager.gschema.xml` | Settings defaults, ranges, shortcuts |
| `stylesheet.css`, `metadata.json` | Shell styling and GNOME 46–51 extension metadata |
| `scripts/package.sh` | Local archive packaging |

The animated demo has its own Remotion project in [`demo/`](demo/README.md).
Its dependencies are separate from the extension, and rendered video files in
`docs/media/` are stored with Git LFS.

## Deferred work

Manual multiwindow grouping, persistent stage layouts, and secondary-monitor management remain outside this version. Interactive validation is still needed for XWayland, native shortcuts and dock activation, lock/unlock, hotplug, and scaling.

## AI, personal use, and licensing

Parts of this project were generated with AI for personal use. Review the code and understand its window-management effects before enabling it. Do **not** upload it to extensions.gnome.org (EGO) unless you understand JavaScript and can maintain the code. Packaging is local only, not submission or publication.

No license file or explicit project license declaration was present in the inspected source. This README does not choose or grant a license; clarify licensing before redistribution or publication.

### Why not ask Wayland to render an app into the preview?

GNOME Shell's compositor is Mutter, and visible previews already use its live
`Clutter.Clone` actors, reusing the window surface rather than repeatedly taking
screenshots. Wayland does not provide a general request to make an arbitrary
client render into another app's window at a chosen size. The compositor consumes
buffers supplied by clients; minimized/hidden clients may stop producing them.
A clone cannot guarantee fresh content once the original surface is unavailable.
The extension therefore keeps a reduced-resolution last-visible image before
minimizing, without restoring hidden windows just to capture them.

API references: [Mutter capture implementation](https://gitlab.gnome.org/GNOME/mutter/-/blob/51.0/src/compositor/meta-window-actor.c),
[Wayland surface lifecycle](https://wayland.freedesktop.org/docs/html/apa.html#protocol-spec-wl_surface).
