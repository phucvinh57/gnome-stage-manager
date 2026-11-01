export function isAppWindow(window, normalType) {
    return window.get_window_type() === normalType && !window.get_transient_for() &&
        !window.is_override_redirect() && !window.skip_taskbar;
}
