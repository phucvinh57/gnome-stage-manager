// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

export function isAppWindow(window, normalType) {
    return window.get_window_type() === normalType && !window.get_transient_for() &&
        !window.is_override_redirect() && !window.skip_taskbar;
}
