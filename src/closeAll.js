// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

// Requests a polite close so apps can still prompt about unsaved work.
// Transient dialogs are skipped: closing their root closes them too.
export function closeAllWindows(windows, normalType, time) {
    for (const window of windows) {
        if (window.get_window_type() === normalType && !window.get_transient_for() &&
            !window.is_override_redirect() && !window.skip_taskbar && window.can_close())
            window.delete(time);
    }
}
