# Repository Guidelines

## Project Structure & Module Organization

This experimental GNOME Shell extension targets GNOME 46–51 on Wayland.
`extension.js` owns lifecycle, panel controls, and shortcuts; `prefs.js` runs
GTK/libadwaita preferences separately. `src/` contains stage selection,
window tracking, arrangement, previews, and minimization ownership. Settings
live in `schemas/`; Shell styling lives in `stylesheet.css`.

`tests/` contains Node.js tests. `scripts/package.sh` builds archives into
ignored `dist/`. Keep the root README user-facing and technical documentation
under `docs/`. The live desktop demo lives in `docs/media/`.

## Build, Test, and Development Commands

- `npm install`: install extension development dependencies.
- `npm run lint`: run ESLint on JavaScript.
- `npm run check`: lint and validate schemas with GLib’s strict dry-run.
- `npm test`: run Node’s test runner with experimental VM modules enabled.
- `bash scripts/package.sh`: build the extension ZIP without installing.
- `npm run pack`: build and install the ZIP for the current user; does not enable it.

After installation or updates on Wayland, log out and back in before enabling
the extension. See `docs/installation.md`.

## Coding Style & Naming Conventions

Follow existing ES module JavaScript: four-space indentation, single quotes,
semicolons, and explicit `.js` import extensions. Use camelCase filenames and
functions, PascalCase classes, and underscore-prefixed internal members.
Follow `eslint.config.js`; unused parameters may use an underscore prefix.
Keep GTK imports out of Shell UI modules and isolate pure logic where practical.

## Testing Guidelines

Use `node:test` and `node:assert/strict`; name files `tests/*.test.js`.
Add focused regression tests for changed behavior, especially geometry,
selection, preview lifecycle, and minimization ownership. No numeric coverage
threshold is configured. Run `npm run check` and `npm test` before submitting.
Mocked tests do not validate desktop behavior: report manual GNOME/Wayland
checks and the Shell version for window-management changes.

## Commit & Pull Request Guidelines

Recent commits use prefixes such as `fix:`, `refactor:`, `build:`, and `docs:`.
Follow that pattern with a concise imperative subject. Describe the problem,
resulting behavior, validation, and relevant issues in PRs. Include screenshots
or video for visual changes and state runtime compatibility limits.

Store demo MP4s through Git LFS using `.gitattributes`; verify with
`git lfs status`. Do not commit dependencies or generated extension archives.
