import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';
import {stageGeometry} from '../src/stageGeometry.js';

export const METRICS = {};
const UUID = 'stage-manager@phucvinh57';
// GNOME 51 can finish the headless startup before main.js finishes importing
// this automation module and connects its startup-complete handler. In that
// case the signal is already gone, so start the perf harness ourselves.
export function init() {
    if (!Main.layoutManager._startingUp)
        Scripting.runPerfScript({run, METRICS}, GLib.getenv('SHELL_PERF_OUTPUT'));
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
    console.log(`PASS: ${message}`);
}
async function settle() {
    await Scripting.sleep(350);
    await Scripting.waitLeisure();
}
export async function run() {
    await settle();
    Main.overview.hide();
    await settle();
    console.log(`Extension diagnostics: enabled=${global.settings.get_strv('enabled-extensions')}, disabled=${global.settings.get_boolean('disable-user-extensions')}, data=${global.userdatadir}`);
    global.settings.set_boolean('disable-user-extensions', false);
    await settle();
    await Main.extensionManager._initializationPromise;
    const extension = Main.extensionManager.lookup(UUID);
    console.log(`Extension lookup: ${extension ? JSON.stringify({state: extension.state, errors: extension.errors, path: extension.path}) : 'not found'}`);
    assert(extension?.stateObj?._controller, 'extension enabled in isolated Shell');
    const instance = extension.stateObj;
    const settings = instance._settings;
    assert(!settings.get_boolean('stage-enabled'), 'safe default leaves stage mode off');
    for (let i = 0; i < 3; i++) {
        await Scripting.createTestWindow({width: 500 + i * 20, height: 320});
        await Scripting.waitTestWindows();
    }
    await settle();
    const windows = global.get_window_actors().map(actor => actor.meta_window)
        .filter(window => window.get_title().includes('gnome-shell-perf-helper'));
    console.log(`Test window titles: ${global.get_window_actors().map(actor => actor.meta_window.get_title()).join(', ')}`);
    assert(windows.length === 3, 'three test windows mapped');
    const [first, second, userMinimized] = windows;
    console.log(`Perf-helper client protocols: ${windows.map(window => `${window.get_client_type() === Meta.WindowClientType.WAYLAND ? 'Wayland' : 'X11/XWayland'} (${window.get_wm_class()})`).join(', ')}`);
    second.maximize();
    await settle();
    const secondMaximized = second.get_maximize_flags();
    assert(secondMaximized !== 0, 'test starts with a maximized existing window');
    userMinimized.minimize();
    Main.activateWindow(first);
    await settle();
    const originalFrames = new Map(windows.map(window => {
        const frame = window.get_frame_rect();
        return [window, {x: frame.x, y: frame.y, width: frame.width, height: frame.height}];
    }));
    settings.set_boolean('stage-enabled', true);
    await settle();
    let controller = instance._controller;
    const expectedFrame = () => stageGeometry(
        Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex),
        settings.get_string('strip-edge'), settings.get_int('preview-width'),
        settings.get_int('window-padding'), settings.get_int('strip-gap')).window;
    const matchesFrame = window => {
        const frame = window.get_frame_rect();
        const expected = expectedFrame();
        return ['x', 'y', 'width', 'height'].every(part => frame[part] === expected[part]);
    };
    await waitFor(() => windows.every(matchesFrame), 'existing windows fill the reserved layout');
    assert(windows.every(matchesFrame), 'existing windows share one frame including hidden stages');
    assert(!controller._strip.actor.visible ||
        controller._strip.actor.x >= first.get_frame_rect().x + first.get_frame_rect().width,
    'right strip stays beside the active window');
    const requested = first.get_frame_rect();
    first.move_resize_frame(true, requested.x + 30, requested.y + 20, 450, 280);
    await Scripting.sleep(700);
    await waitFor(() => matchesFrame(first), 'manual resize is reapplied');
    assert(matchesFrame(first), 'manual resize returns to the reserved frame');
    first.maximize();
    await Scripting.sleep(700);
    await waitFor(() => !first.get_maximize_flags() && matchesFrame(first),
        'manual maximization is reapplied');
    assert(!first.get_maximize_flags() && matchesFrame(first),
        'manual maximization returns to the reserved frame');
    assert(!first.minimized && second.minimized, 'enabling keeps focused window and minimizes inactive window');
    assert(controller._ledger.has(second), 'inactive minimization is extension-owned');
    assert(!controller._ledger.has(userMinimized), 'preexisting user minimization is not owned');
    const secondId = second.get_stable_sequence();
    controller.activate(secondId);
    await settle();
    assert(!second.minimized && first.minimized, 'preview activation switches stage');
    assert(controller.activeId === secondId, 'selected stage remains active after focus notifications');
    const firstCard = controller._strip._cards.get(first.get_stable_sequence());
    assert(Boolean(firstCard._snapshot),
        'inactive formerly visible root has a captured snapshot');
    const content = firstCard._snapshot.content;
    const [hasSize, contentWidth, contentHeight] = content.get_preferred_size();
    const texture = content.get_texture();
    assert(hasSize && contentWidth > 0 && contentHeight > 0 &&
        texture.get_width() > 0 && texture.get_height() > 0,
    'snapshot contains a nonempty GPU thumbnail texture, not just an actor');
    assert(texture.get_width() <= 640 && texture.get_height() <= 896,
        'cached texture is bounded to thumbnail resolution');
    assert(firstCard._snapshot.visible && !firstCard._fallback.visible && !firstCard._clone,
        'inactive card displays the retained window image instead of the fallback');
    const projection = firstCard._thumbnail.get_transform().to_float();
    assert(firstCard._thumbnail.rotation_angle_y === 0 &&
        firstCard._thumbnail.rotation_angle_z === 0 &&
        projection[3] > 0 && projection[1] > 0 && projection[15] === 1,
    'window thumbnail uses explicit trapezium perspective without sideways roll');
    assert(firstCard._icon.visible && firstCard._icon.icon_size === 24 &&
        firstCard._icon.has_style_class_name('stage-manager-app-badge') && !firstCard._title,
    'card uses a small app badge without a visible title/header');
    const expectedHeight = Math.round(firstCard._width *
        Math.min(1.4, firstCard._snapshotHeight / firstCard._snapshotWidth));
    assert(firstCard._height === expectedHeight &&
        Math.abs(firstCard._snapshot.width / firstCard._snapshot.height -
            firstCard._snapshotWidth / firstCard._snapshotHeight) < 0.03,
    'snapshot and thumbnail preserve the window aspect ratio');
    const retainedSnapshot = firstCard._snapshot;
    assert(!firstCard.capture() && firstCard._snapshot === retainedSnapshot && first.minimized,
        'recapture of an inactive window retains its image without restoring it');
    const minimizedCard = controller._strip._cards.get(userMinimized.get_stable_sequence());
    assert(!minimizedCard._snapshot && minimizedCard._fallback.visible &&
        !minimizedCard._icon.visible && minimizedCard._thumbnail.width === minimizedCard._width,
    'icon fallback has a full-width tile without a duplicate app badge');
    controller.cycle(1);
    await settle();
    assert(controller.activeId === first.get_stable_sequence(), 'keyboard cycle skips user-minimized stage');
    second.unminimize();
    await settle();
    assert(!second.minimized && controller.activeId === secondId,
        'external unminimize selects the restored root before any explicit focus request');
    Main.activateWindow(second);
    await settle();
    assert(controller.activeId === secondId && first.minimized, 'native external activation selects stage');
    settings.set_string('strip-edge', 'left');
    settings.set_int('preview-width', 220);
    settings.set_int('window-padding', 24);
    settings.set_int('strip-gap', 32);
    await waitFor(() => windows.every(matchesFrame), 'live preferences resize each stage');
    assert(windows.every(matchesFrame), 'live edge, width, padding and gap reflow windows');
    await settle();
    Main.overview.show();
    await settle();
    assert(!first.minimized && !second.minimized, 'Overview restores extension-owned windows');
    assert(userMinimized.minimized, 'Overview preserves user minimization');
    Main.overview.hide();
    await settle();
    settings.set_boolean('stage-enabled', false);
    await settle();
    assert(!first.minimized && !second.minimized && userMinimized.minimized, 'toggle off restores only extension-owned windows');
    assert(windows.every(window => {
        const frame = window.get_frame_rect();
        const original = originalFrames.get(window);
        return ['x', 'y', 'width', 'height'].every(part => frame[part] === original[part]);
    }), 'toggle off restores original frames');
    assert(second.get_maximize_flags() === secondMaximized,
        'toggle off restores the original maximize state');
    settings.set_boolean('stage-enabled', true);
    await settle();
    Main.extensionManager.disableExtension(UUID);
    await settle();
    assert(!first.minimized && !second.minimized && userMinimized.minimized, 'disable restores owned windows');
    Main.extensionManager.enableExtension(UUID);
    await settle();
    controller = Main.extensionManager.lookup(UUID).stateObj._controller;
    assert(controller, 'extension can re-enable');
    Main.extensionManager.lookup(UUID).stateObj._settings.set_boolean('stage-enabled', false);
    await settle();
    // Run the remaining scenarios only after the original ownership/lifecycle
    // assertions: explicitly restoring this root changes its user-minimized state.
    const currentSettings = Main.extensionManager.lookup(UUID).stateObj._settings;
    Main.activateWindow(first);
    currentSettings.set_boolean('stage-enabled', true);
    await settle();
    controller._strip._cards.get(userMinimized.get_stable_sequence()).actor.emit('clicked', 1);
    await settle();
    assert(!userMinimized.minimized && controller.activeId === userMinimized.get_stable_sequence(),
        'preview card click restores a preexisting user-minimized root');
    userMinimized.minimize();
    await settle();
    assert(userMinimized.minimized && !controller._ledger.has(userMinimized),
        'explicit user minimization of the active stage is preserved and unowned');
    assert(controller.activeId !== userMinimized.get_stable_sequence() &&
        controller.records.some(record => record.id === controller.activeId && !record.window.minimized),
    'minimizing the active stage selects a visible fallback');

    const workspace = global.workspace_manager.get_active_workspace();
    const otherWorkspace = global.workspace_manager.get_workspace_by_index(workspace.index() + 1) ??
        global.workspace_manager.append_new_workspace(false, global.get_current_time());
    controller.activate(first.get_stable_sequence());
    await settle();
    assert(second.minimized && controller._ledger.has(second),
        'workspace scenario starts with an owned inactive window');
    second.change_workspace(otherWorkspace);
    controller.activate(secondId);
    assert(global.workspace_manager.get_active_workspace() === workspace,
        'stale preview activation cannot switch to a moved root workspace');
    await settle();
    assert(!second.minimized && !controller._ledger.has(second),
        'moving an owned window out of context restores it');
    assert(!first.minimized && userMinimized.minimized,
        'moving a window does not disturb active or user-minimized roots');
    otherWorkspace.activate(global.get_current_time());
    controller.activate(first.get_stable_sequence());
    assert(global.workspace_manager.get_active_workspace() === otherWorkspace,
        'stale old-context card activation cannot undo an immediate workspace switch');
    await settle();
    assert(controller.activeId === secondId && !second.minimized,
        'workspace switch selects a root in the destination workspace');
    assert(!first.minimized && userMinimized.minimized,
        'workspace switch does not minimize roots in the previous context');
    workspace.activate(global.get_current_time());
    await settle();
    assert(controller.activeId === first.get_stable_sequence() && !first.minimized && !second.minimized,
        'switching back restores the original context without cross-workspace minimization');
    second.change_workspace(workspace);
    await settle();
    controller.activate(first.get_stable_sequence());
    await settle();
    assert(second.minimized && controller._ledger.has(second),
        'moving a root into the active context resumes stage management');

    first.make_fullscreen();
    await settle();
    assert(global.display.get_monitor_in_fullscreen(first.get_monitor()),
        'fullscreen scenario really enters monitor fullscreen');
    assert(!controller._strip.actor.visible, 'fullscreen suppresses the stage strip');
    first.unmake_fullscreen();
    await waitFor(() => controller._strip.actor.visible,
        'leaving fullscreen restores the strip after frame resize');
    assert(controller._strip.actor.visible, 'leaving fullscreen restores the stage strip');

    second.make_above();
    await settle();
    assert(!controller.records.some(record => record.window === second) && !second.minimized,
        'always-on-top roots are excluded and restored');
    second.unmake_above();
    await settle();
    second.stick();
    await settle();
    assert(!controller.records.some(record => record.window === second) && !second.minimized,
        'sticky roots are excluded and restored');
    second.unstick();
    await settle();
    controller.activate(first.get_stable_sequence());
    await settle();
    const closedId = first.get_stable_sequence();
    first.delete(global.get_current_time());
    await settle();
    assert(!controller.records.some(record => record.id === closedId),
        'closing the active window removes its stage');
    assert(controller.activeId === secondId && !second.minimized,
        'closing the active window selects and restores the remaining fallback');
    assert(userMinimized.minimized && !controller._ledger.has(userMinimized),
        'closure fallback still preserves the independently user-minimized root');
    currentSettings.set_boolean('stage-enabled', false);
    await settle();
    await testTransients(currentSettings, controller, second);
    // CLI talks only to this private session bus. Preferences-process output
    // inherits the test log, where test-shell.sh rejects JavaScript errors.
    const prefs = Gio.Subprocess.new(['gnome-extensions', 'prefs', UUID], Gio.SubprocessFlags.NONE);
    await new Promise((resolve, reject) => prefs.wait_check_async(null, (process, result) => {
        try {
            process.wait_check_finish(result);
            resolve();
        } catch (error) {
            reject(error);
        }
    }));
    await settle();
    assert(true, 'preferences launch request succeeds on the isolated session bus');
    if (GLib.getenv('STAGE_MANAGER_TEST_LARGE') === '1')
        await testLargeSnapshots(currentSettings, controller, second);
    await testNewWindowFirstFrame(currentSettings, controller, second);
    await testFullscreenDisable(currentSettings, controller, second);
    await Scripting.destroyTestWindows();
    await settle();
    console.log('STAGE_MANAGER_INTEGRATION_PASS');
}

async function testFullscreenDisable(settings, controller, window) {
    Main.activateWindow(window);
    settings.set_boolean('stage-enabled', true);
    await waitFor(() => Boolean(controller._arranger._states.get(window)),
        'fullscreen test window is arranged');
    const original = controller._arranger._states.get(window).original;
    window.make_fullscreen();
    await settle();
    settings.set_boolean('stage-enabled', false);
    await Scripting.sleep(900);
    assert(window.is_fullscreen(), 'disabling Stage Manager preserves fullscreen');
    window.unmake_fullscreen();
    await settle();
    const frame = window.get_frame_rect();
    assert(['x', 'y', 'width', 'height'].every(part => frame[part] === original[part]),
        'fullscreen window recovers its original frame after exit');
}

async function testNewWindowFirstFrame(settings, controller, selectedRoot) {
    Main.activateWindow(selectedRoot);
    settings.set_boolean('stage-enabled', true);
    await settle();
    const previous = new Set(global.get_window_actors().map(actor => actor.meta_window));
    await Scripting.createTestWindow({width: 480, height: 320});
    await Scripting.waitTestWindows();
    await waitFor(() => global.get_window_actors().some(actor =>
        !previous.has(actor.meta_window) && actor.meta_window.get_title().includes('gnome-shell-perf-helper')),
    'new window maps while stage management is active');
    const opened = global.get_window_actors().map(actor => actor.meta_window)
        .find(window => !previous.has(window) && window.get_title().includes('gnome-shell-perf-helper'));
    await waitFor(() => !controller._tracker.records.find(record => record.window === opened)?.awaitingFrame,
        'new window supplies its first frame');
    controller.activate(selectedRoot.get_stable_sequence());
    await waitFor(() => opened.minimized &&
        Boolean(controller._strip._cards.get(opened.get_stable_sequence())?._snapshot),
    'newly opened inactive window is captured before minimization');
    const card = controller._strip._cards.get(opened.get_stable_sequence());
    assert(card._snapshot.visible && !card._fallback.visible && card._icon.visible,
        'newly opened window displays its captured frame and one app badge');
    const layout = stageGeometry(Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex),
        settings.get_string('strip-edge'), settings.get_int('preview-width'),
        settings.get_int('window-padding'), settings.get_int('strip-gap'));
    await waitFor(() => ['x', 'y', 'width', 'height'].every(part =>
        opened.get_frame_rect()[part] === layout.window[part]),
    'newly opened window uses the reserved frame');
    assert(true, 'newly opened eligible window shares the stage frame');
    settings.set_boolean('stage-enabled', false);
    await settle();
}

async function testLargeSnapshots(settings, controller, otherRoot) {
    // Real compositor surfaces, not patched resource scales or source sizes.
    // The opt-in harness supplies enough virtual-monitor space for these clients.
    const previous = new Set(global.get_window_actors().map(actor => actor.meta_window));
    for (let i = 0; i < 3; i++) {
        await Scripting.createTestWindow({width: 3840, height: 2400});
        await Scripting.waitTestWindows();
    }
    await settle();
    const windows = global.get_window_actors().map(actor => actor.meta_window)
        .filter(window => !previous.has(window) &&
            window.get_title().includes('gnome-shell-perf-helper'));
    assert(windows.length === 3, 'three large native test windows mapped');
    Main.activateWindow(windows[0]);
    await settle();
    settings.set_boolean('stage-enabled', true);
    await settle();
    const cards = windows.map(window => controller._strip._cards.get(window.get_stable_sequence()));
    const textureBytes = card => {
        assert(Boolean(card?._snapshot), 'large window retains a captured image');
        const texture = card._snapshot.content.get_texture();
        const width = texture.get_width();
        const height = texture.get_height();
        const bytes = width * height * 4;
        console.log(`Large snapshot native texture: ${width}x${height}, RGBA8 bytes=${bytes}`);
        assert(width <= 640 && height <= 896 && bytes <= 640 * 896 * 4 &&
            width / height > 1.5 && width / height < 1.7,
        '4K source is downsampled into an aspect-preserving thumbnail texture');
        return bytes;
    };
    const total = cards.reduce((bytes, card) => bytes + textureBytes(card), 0);
    assert(total <= 3 * 640 * 896 * 4,
        'three 4K previews retain at most 6.6 MiB rather than 105 MiB');

    const before = cards.map(card => card._snapshot);
    assert(cards[0].capture() && cards[0]._snapshot !== before[0],
        'visible large window can replace its snapshot while three images are retained');
    textureBytes(cards[0]);
    assert(cards.slice(1).every((card, index) => card._snapshot === before[index + 1]),
        'large snapshot replacement does not evict either other retained image');

    // Selecting an existing small root leaves all three large windows inactive.
    controller.activate(otherRoot.get_stable_sequence());
    await settle();
    const inactive = cards.map(card => card._snapshot);
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        assert(windows[i].minimized && controller._ledger.has(windows[i]) &&
            card._snapshot.visible && !card._fallback.visible && !card._clone,
        'inactive large window displays its real retained image instead of fallback');
        assert(!card.capture() && card._snapshot === inactive[i] && windows[i].minimized,
            'inactive large image survives recapture without restoring its window');
        textureBytes(card);
    }
    await settle();
    assert(cards.every((card, index) => card._snapshot === inactive[index] && card._snapshot.visible),
        'all three inactive large images survive subsequent controller settling');
    settings.set_boolean('stage-enabled', false);
    await settle();
    console.log('STAGE_MANAGER_LARGE_CAPTURE_PASS');
}

async function waitFor(predicate, message) {
    for (let attempt = 0; attempt < 40; attempt++) {
        if (predicate())
            return;
        await Scripting.sleep(100);
    }
    throw new Error(`Timed out: ${message}`);
}

async function fixtureCall(method) {
    await new Promise((resolve, reject) => {
        Gio.DBus.session.call('org.gnome.StageManagerFixture', '/org/gnome/StageManagerFixture',
            'org.gnome.StageManagerFixture', method, null, null,
            Gio.DBusCallFlags.NONE, 3000, null, (connection, result) => {
                try {
                    connection.call_finish(result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
    });
}

async function testTransients(settings, controller, otherRoot) {
    const [fixturePath] = GLib.filename_from_uri(import.meta.url.replace(/shellIntegration\.js$/, 'windowFixture.js'));
    const launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
    // Mutter publishes its private socket in the Shell environment. Never use
    // the invoking desktop's display or bus, even if this test is run locally.
    const display = GLib.getenv('WAYLAND_DISPLAY');
    assert(Boolean(display), 'isolated compositor exports its Wayland display to children');
    launcher.setenv('GDK_BACKEND', 'wayland', true);
    launcher.setenv('WAYLAND_DISPLAY', display, true);
    const child = launcher.spawnv(['gjs', '-m', fixturePath]);
    const find = title => global.get_window_actors().map(actor => actor.meta_window)
        .find(window => window.get_title() === title);
    try {
        await waitFor(() => find('StageManagerFixture root'), 'GTK fixture root mapped');
        await fixtureCall('ShowDialog');
        await waitFor(() => find('StageManagerFixture dialog'), 'GTK transient mapped');
        const root = find('StageManagerFixture root');
        const dialog = find('StageManagerFixture dialog');
        console.log(`GTK fixture client protocols: root=${root.get_client_type()}, dialog=${dialog.get_client_type()}, WAYLAND=${Meta.WindowClientType.WAYLAND}, backend=wayland`);
        assert(dialog.get_transient_for() === root, 'GTK fixture supplies a real Mutter transient relationship');
        settings.set_boolean('stage-enabled', true);
        await settle();
        controller.activate(root.get_stable_sequence());
        await settle();
        assert(controller.records.some(record => record.window === root) &&
            !controller.records.some(record => record.window === dialog),
        'transient dialog belongs to its root rather than creating a stage');
        controller.activate(otherRoot.get_stable_sequence());
        await settle();
        console.log(`Transient diagnostics: root=${root.minimized}, dialog=${dialog.minimized}, canMinimize=${dialog.can_minimize()}, showing=${dialog.showing_on_its_workspace()}, actorVisible=${dialog.get_compositor_private()?.visible}`);
        assert(root.minimized && !dialog.showing_on_its_workspace(),
            'inactive root and transient are hidden as one family');
        controller.activate(root.get_stable_sequence());
        await settle();
        assert(!root.minimized && !dialog.minimized && dialog.showing_on_its_workspace(),
            'selecting a family restores its root and makes the transient visible');
        await fixtureCall('ShowFixed');
        await waitFor(() => find('StageManagerFixture fixed'), 'fixed-size GTK fixture mapped');
        const fixed = find('StageManagerFixture fixed');
        controller.activate(fixed.get_stable_sequence());
        await waitFor(() => Boolean(controller._arranger._states.get(fixed)?.constrained),
            'fixed-size window is recognized as constrained');
        assert(!fixed.allows_resize() && !controller._strip.actor.visible &&
            !controller._arranger._states.get(fixed).requested,
        'fixed-size window hides the strip without repeated resize requests');
        if (!dialog.can_minimize()) {
            console.log('SKIP: Mutter modal transient cannot be independently user-minimized');
            settings.set_boolean('stage-enabled', false);
            await settle();
            await fixtureCall('Quit');
            return;
        }
        dialog.minimize();
        await settle();
        controller.activate(otherRoot.get_stable_sequence());
        await settle();
        controller.activate(root.get_stable_sequence());
        await settle();
        assert(dialog.minimized && !controller._ledger.has(dialog),
            'family activation preserves an independently user-minimized transient');
        settings.set_boolean('stage-enabled', false);
        await settle();
        assert(!root.minimized && dialog.minimized,
            'toggle off preserves user-minimized transient while restoring root');
        await fixtureCall('Quit');
        await new Promise((resolve, reject) => child.wait_check_async(null, (process, result) => {
            try {
                process.wait_check_finish(result);
                resolve();
            } catch (error) {
                reject(error);
            }
        }));
    } finally {
        // force_exit is harmless after a successful exit and avoids leaked
        // fixture processes when an assertion aborts this private session.
        child.force_exit();
    }
}
