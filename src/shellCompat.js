// Mutter 49 changed the maximization API. Keep the original horizontal and
// vertical flags when restoring a window on either side of that change.
export function maximizeFlags(window) {
    return window.get_maximize_flags?.() ?? window.get_maximized();
}

export function maximizeWindow(window) {
    if (window.get_maximize_flags)
        window.maximize();
    else
        window.maximize(3); // horizontal | vertical on Mutter 46–48
}

export function unmaximizeWindow(window) {
    const flags = maximizeFlags(window);
    if (!flags)
        return;
    if (window.get_maximize_flags)
        window.unmaximize();
    else
        window.unmaximize(flags);
}

export function restoreMaximizeFlags(window, flags) {
    if (!flags)
        return;
    if (window.set_maximize_flags)
        window.set_maximize_flags(flags);
    else
        window.maximize(flags);
}

// St.Settings.reduced-motion was added in Shell 51. GObject rejects a notify
// connection for a property that does not exist on older releases.
export function supportsReducedMotion(settings) {
    return 'reduced_motion' in settings;
}
