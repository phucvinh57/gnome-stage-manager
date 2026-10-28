// Mutter 49 changed the maximization API and removed Meta.Window's legacy
// maximized getter; older releases expose the same state as properties.
export function maximizeFlags(window) {
    if (window.get_maximize_flags)
        return window.get_maximize_flags();
    return (window.maximized_horizontally ? 1 : 0) |
        (window.maximized_vertically ? 2 : 0);
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

// St.Settings.reduced-motion was added in Shell 51. GObject rejects a notify
// connection for a property that does not exist on older releases.
export function supportsReducedMotion(settings) {
    return 'reduced_motion' in settings;
}
