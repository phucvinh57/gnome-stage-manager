# Manual validation — GNOME 51 Stage Manager

**Interactive tests are pending.** Lint, Node unit tests, strict schema validation, and the isolated Shell test passed on 2026-10-25. Unchecked items below remain planned checks, not passed desktop results. The verified environment is Ubuntu 26.10 / GNOME Shell 51.0 / Wayland, primary display 3840×2400 at scale 2, Ubuntu Dock enabled, Tiling Assistant not enabled. No extension compatibility result follows from that environment verification.

For every run, record date, source revision/snapshot, Shell version, session type, monitor geometry/scaling, enabled extensions, steps, actual results, and relevant logs. Mark items only after observing them; note unavailable hardware/features as not tested rather than passed. Use disposable windows and save work first.

## Preparation and automated checks

- [ ] Confirm `gnome-shell --version`, Ubuntu release, Wayland session, primary monitor and scaling; record any differences from the environment above.
- [x] Run `npm run check`: exit 0 on 2026-10-25; ESLint, four Node test files, and strict schema dry-run passed. This is not desktop integration validation.
- [x] Packaging creates `dist/stage-manager@phucvinh57.shell-extension.zip` without live installation/enabling or publication (2026-10-25).
- [x] `tests/shellIntegration.js` is supplied for isolated controller/compositor checks; passing it does not replace the interactive matrix below.
- [x] `npm run test:shell`: exit 0, 64 assertions, `STAGE_MANAGER_INTEGRATION_PASS`, no JavaScript errors (2026-10-25). Log: `dist/shell-test.log`. Not proof of full interactive coverage.
- [ ] Install Ubuntu's `mutter-dev-bin`, then run `npm run test:interactive` for a disposable visual Shell. The launcher now compiles schemas in its temporary extension directory; startup was blocked here by the missing development kit.
- [x] Shell testing used temporary XDG/runtime directories and a private D-Bus session, with invoking display variables unset; no live installation/enabling or live settings edits.
- [ ] Install locally with `gnome-extensions install --force dist/stage-manager@phucvinh57.shell-extension.zip`, log out/in, then run `gnome-extensions enable stage-manager@phucvinh57`. Confirm these are explicit steps, not side effects of packing.
- [ ] With fresh settings, confirm the extension loads with `stage-enabled=false`, the panel switch is off, and windows remain untouched. On an existing profile, record any retained setting instead of assuming a fresh default.

## Basic stages and keyboard access

- [ ] Open three distinguishable normal windows A/B/C on the primary monitor/current workspace. Record positions, sizes, and maximize state. Turn on the panel switch; verify all eligible windows use one frame beside the strip.
- [ ] Select A/B/C repeatedly by card. Confirm the selected window is restored/focused, inactive eligible windows are minimized, and switching stages does not change their shared frame.
- [ ] Test `<Super><Shift>space`, `<Super><Shift>bracketright`, and `<Super><Shift>bracketleft`. Confirm toggle and stable forward/backward wraparound without two-window oscillation. Check the actual keyboard layout for conflicts.
- [ ] While stage management is off, invoke next/previous and verify it turns on. Confirm unrelated shortcuts are unaffected.
- [ ] Reach the strip through Ctrl+Alt+Tab; navigate cards with Tab/arrows and activate with Space/Enter. Check visible focus, readable titles, and that passive refreshes do not steal focus.
- [ ] Create enough windows to overflow the strip. Scroll and keyboard-navigate to offscreen cards; confirm the selected card becomes visible and cards do not shrink to unusable sizes.
- [ ] Verify frameless, left-tilted window images with app badges and no solid strip/card rectangles. Compare landscape and portrait windows; check hover, focus outline, clipping, and both strip edges at widths 100/180/320 and scale 1/2. Titles should remain announced by accessibility tools even though no title row is drawn.
- [ ] Verify title/icon updates and reasonable icon fallbacks. Minimized/unallocated actors must not be restored just to produce thumbnails; do not require continuously live previews.
- [ ] With stage management on, launch Telegram and another slow-starting app while a different stage is active. Confirm their cards appear with a rendered window after the first frame, without overlapping large/small icons. Check a previously user-minimized app shows one centered fallback icon.
- [ ] With only one stage, note its frame. Open a second stage and verify the first keeps exactly the same frame. Repeat for both strip edges and preview widths 100/180/320.
- [ ] Move, resize, and maximize the active window. Confirm it returns to the configured frame after the action ends and that the strip stays hidden while a resize is pending.
- [ ] Test fixed-size and large-minimum-size applications. If their frame cannot fit, confirm the strip hides instead of covering them or repeatedly resizing them.

## Window types, focus, and minimization safety

- [ ] Repeat stage switching with native Wayland applications and an available XWayland application; record which windows use which protocol. Check focus, title updates, and minimize/restore behavior for each.
- [ ] Open a transient/modal dialog (such as a file chooser) for one stage. Switch away/back; verify it follows its parent and does not become a separate stage. Test nested dialogs where available.
- [ ] Independently minimize a dialog, then switch stages and turn management off. Confirm it is not restored solely by ledger cleanup; note application-specific parent/dialog coupling.
- [ ] Use Alt+Tab to select an inactive window, including one minimized by the extension. Verify a usable focused stage and no focus/minimization loop; record ambiguous external-restore behavior.
- [ ] Minimize a window yourself before enabling management. Toggle management on/off and disable the extension; verify the user-minimized window remains minimized.
- [ ] Minimize the active stage yourself. Check that another eligible stage is selected; if all windows are user-minimized, no window should be implicitly restored by fallback/cycling. Explicit card selection may restore its root window.
- [ ] Restore an inactive window externally through Overview or Ubuntu Dock, then minimize it yourself and toggle off. Verify the restore selects its stage and the subsequent user minimization is preserved; record application-specific ambiguities.
- [ ] Close the active window, then an inactive window and a dialog. Confirm sensible fallback, removed cards, and no stale actor/signal errors. Repeat with rapid close/open operations.
- [ ] Check excluded top-level windows (always-on-top, sticky/all-workspaces, skip-taskbar, non-minimizable where available) remain unmanaged. Do not expect them to become stages.

## Shell context and display changes

- [ ] Enter Overview while stages are active. Confirm the strip hides and extension-owned minimizations are restored, while user-minimized windows are preserved. Leave Overview and check stage management resumes without a focus loop.
- [ ] Switch between at least two workspaces, including an empty workspace. Verify only current-workspace primary-monitor windows are managed and windows leaving the context are restored if owned.
- [ ] Move a window between workspaces while active/inactive. Check cards, original frame restoration, and maximize state without affecting unrelated workspaces.
- [ ] With a second monitor, keep normal windows on both displays. Verify secondary-monitor windows are not stage-managed and the strip stays on the primary monitor. Move windows between monitors and check the user's placement survives release from management.
- [ ] Change the primary monitor, then hotplug/unplug an external display. Confirm strip bounds/scaling update, no orphaned overlay remains, and windows leaving scope are restored when owned. Record fallback behavior when displays disappear.
- [ ] Lock and unlock the session. Confirm no strip/input region on the lock screen, extension-owned windows are restored during suspension, and stage management resumes cleanly afterward.
- [ ] Enter/leave fullscreen on the primary monitor. Confirm the strip and its input region hide while fullscreen and return appropriately; fullscreen hiding is not the same as Overview suspension. Repeat with fullscreen on a secondary monitor.
- [ ] Test scale 2 at 3840×2400 and, if available, another scaling/resolution. Check card clipping, scroll area, work-area alignment, and keyboard accessibility.

## Preferences, motion, and lifecycle

- [ ] Open preferences from the panel and via `gnome-extensions prefs stage-manager@phucvinh57`. Toggle management there and confirm the panel stays synchronized.
- [ ] Change left/right edge, preview width (100–320 logical pixels, default 180), window padding and strip gap (0–128, default 16), and animation duration (0–400 ms, default 160). Verify window and strip move together and settings persist after reopening preferences.
- [ ] Toggle Stage Manager off and disable the extension after arranging regular and maximized windows. Confirm their saved frames and maximize states return.
- [ ] Edit each shortcut with a valid GTK accelerator and Apply/Enter. Confirm the binding updates, an invalid value is marked red and not saved, and clearing the field disables the action. Restore defaults afterward.
- [ ] Enable reduced motion/disable Shell animations, including during a card fade. Confirm fades finish immediately and new cards appear without animation. Repeat with animation duration 0.
- [ ] Repeat panel on/off at least ten times. Verify owned windows restore on off, user-minimized windows stay minimized, and there are no duplicate cards or accumulating focus issues.
- [ ] Repeat `gnome-extensions disable stage-manager@phucvinh57` and `gnome-extensions enable stage-manager@phucvinh57` at least ten times. Check panel, keybindings, chrome, signals, and owned-window restoration; account for the persisted `stage-enabled` setting on re-enable.
- [ ] Close/reopen preferences during toggles and display/workspace changes. Inspect session logs for JavaScript errors and report actual findings rather than inferring cleanup correctness from appearance alone.

## Ubuntu extension interaction

- [ ] With Ubuntu Dock enabled (the verified environment baseline), test application launch, card selection, dock restore/minimize, autohide, and maximized/fullscreen windows. Check strip and dock input conflicts on both edges.
- [ ] Record that Tiling Assistant is not enabled in the baseline. In a separate deliberate run, enable it if available and test tiling, restoring, stage switching, and window geometry preservation. Record its version and interactions; do not claim compatibility without this run. Restore the original extension configuration afterward.

## Recovery drill and known limits

- [ ] From a desktop terminal run `gnome-extensions disable stage-manager@phucvinh57`. Verify the panel/strip/bindings disappear and only extension-owned minimized windows are restored.
- [ ] Confirm access to a TTY and document the graphical session's return VT. As the same logged-in desktop user, test targeting the existing user bus with the command below. Do not use root or a new `dbus-run-session` for recovery.

  ```sh
  uid=$(id -u)
  XDG_RUNTIME_DIR="/run/user/$uid" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$uid/bus" \
    gnome-extensions disable stage-manager@phucvinh57
  ```

- [ ] Confirm that ordinary recovery does not kill/replace the live Shell. If Shell or the bus is unresponsive, record that the disable command cannot guarantee recovery; do not force a live Wayland Shell crash as a test.
- [ ] Review the crash limitation without deliberately crashing the live Shell: minimization ownership is in memory and is lost on a Shell crash. Any windows left minimized may require manual restoration through Overview or the dock after session recovery; disable cannot reconstruct ownership.
- [ ] Confirm documentation expectations: no persistent stage groups, no geometry layout, no exact macOS visuals, and no guarantee of live previews or perfect inference of external restore/user-minimize intent.

## Automated run — 2026-10-25

- Source: initial implementation, uncommitted project files; GNOME Shell 51.0 headless Wayland session.
- `npm run check`: exit 0, 26 unit tests; `npm run test:shell`: exit 0, 44 assertions; local packaging succeeded.
- Isolated checks include stage switching/cycling, actual card activation, user minimization, delayed external restore, workspace switching/moves and both stale-card regressions, Overview, fullscreen, sticky/above exclusions, closure fallback, in-memory snapshots/icon fallback, transient grouping/visibility/restoration, disable/re-enable, and preferences launch.
- Perf-helper and GTK fixture clients were confirmed Wayland. XWayland not tested.
- Independent user minimization of the modal transient was skipped: Mutter reports `can_minimize=false`. Root minimization/activation correctly hides/restores its transient visibility.
- Headless session emits systemd/accessibility/portal warnings and an upstream Adwaita introspection warning; no JavaScript errors. A preferences accelerator-description markup warning was fixed by escaping angle brackets.
- All interactive checklist items remain unexecuted, including native shortcuts/dock, lock/unlock, hardware display changes, scaling and extension coexistence.

## Frameless preview update — 2026-10-25

- Replaced solid strip/cards and title rows with transparent, left-tilted window images and small app badges. Titles remain accessible names; keyboard focus retains an outline.
- Visible source attachment/first-frame now seeds a snapshot; failed captures retain the last good image. Already-minimized windows without a snapshot and oversized captures still use safe icon fallbacks.
- `npm run check`: exit 0, 26 unit tests. Isolated Shell test: exit 0, 50 assertions, including native texture dimensions, displayed inactive snapshots, tilt/badge/aspect ratio, and no restore on hidden recapture.
- These checks do not prove pixel appearance, HiDPI rendering, or interactive desktop compatibility; manual appearance/scaling checks above remain pending.

## 4K capture limit correction — 2026-10-25

- A native 3840×2400 RGBA8 image requires 36,864,000 bytes (~35.16 MiB), exceeding the former 32 MiB per-image limit. A maximized 1920×1200 logical window at scale 2 can therefore fall back to an icon even with a valid surface.
- Raised the per-image limit to 64 MiB and total logical cache budget to 256 MiB, allowing several 4K snapshots plus replacement allocation. Capture remains native-resolution, not downsampled. This is not a hard GPU-memory ceiling: native/GJS release can lag eviction, and GPU/driver overhead is additional. Pre-capture eviction is not rolled back on failure.
- Installed source matched the project at diagnosis. The size rejection is a likely explanation for the reported Terminal/Chrome icons, not a capture trace from those specific windows.
- `STAGE_MANAGER_TEST_LARGE=1 npm run test:shell`: exit 0, 75 assertions. Private 4000×2600 virtual monitor; three actual 4000×2568 RGBA8 textures (41,088,000 bytes each) were captured, retained together, replaced without evicting peers, and displayed inactive. No mocked resource scales or dimensions. This validates large native allocations at scale 1, not the host's actual scale-2 path.
- `npm run check`: exit 0 (26 Node tests, lint, strict schema dry-run). Package built at `dist/stage-manager@phucvinh57.shell-extension.zip`.
- Interactive Terminal/Chrome appearance and actual scale-2 capture still require verification after reloading the corrected extension. Already-minimized windows without a cached image must be activated once; capture never restores them automatically.

## Trapezium preview shape — 2026-10-25

- Replaced camera-dependent Y/Z rotation with an explicit homogeneous projection shared by live clones, retained snapshots, and icon fallbacks. Left edge is full height; right edge is 72% height, centered vertically, at 90% of the original width. No sideways roll, solid card, or strip background.
- Geometry tests cover landscape, portrait, and minimum-size previews. Interactive comparison with the supplied sketch remains to be checked on the desktop.

## Interactive run record

- Date / source snapshot:
- OS / Shell / session:
- Displays / primary / scaling:
- Ubuntu Dock / Tiling Assistant / other extensions:
- Automated commands and exit codes:
- Completed checklist items and observations:
- Failures / logs / reproduction steps:
- Not-tested items and reasons:

Leave unexecuted checklist items unchecked. A successful isolated test does not replace the interactive cases above.

## GPU-downsampled preview update — 2026-10-25

- `npm run check`: exit 0, 34 Node tests, ESLint and strict schema validation.
- `STAGE_MANAGER_TEST_LARGE=1 npm run test:shell`: exit 0, 76 assertions; both integration and large-capture pass markers, no JavaScript errors.
- Three real 3840×2400 clients (including compositor decorations) each retained a 640×410 RGBA8 texture, 1,049,600 bytes. Replacement preserved other previews; hidden recapture retained snapshots without restoring windows.
- GPU filtering, alpha, orientation and HDR/color appearance have not been pixel-verified; dimensions/actor visibility alone do not establish visual correctness. Check asymmetric content, translucent windows and text at scale 1/2 interactively. Native temporary capture remains full resolution; budgets are logical, not hard native-memory ceilings.
