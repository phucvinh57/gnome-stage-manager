// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.
import {isAppWindow} from './appWindow.js';

// Requests a polite close so apps can still prompt about unsaved work.
export function closeAllWindows(windows, normalType, time) {
    for (const window of windows) {
        if (isAppWindow(window, normalType) && window.can_close())
            window.delete(time);
    }
}
