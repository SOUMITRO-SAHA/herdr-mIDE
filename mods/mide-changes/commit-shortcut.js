// Modified Enter submits only while the commit message itself has focus:
// Ctrl+Enter everywhere, and the platform key (Cmd) on macOS, where it is the
// expected chord in a text field. The platform key stays with the system on
// Windows and Linux, so Super/Meta chords there are never taken over.
export function handleCommitShortcut(event, cx, view, platform = "") {
  const modifiers = event.modifiers ?? {};
  const bare = !modifiers.shift && !modifiers.alt && !modifiers.function;
  const submits =
    (modifiers.control && !modifiers.platform && bare) ||
    (platform === "macos" && modifiers.platform && !modifiers.control && bare);
  if (!view.typing || view.view !== "changes" || event.key !== "enter" || event.is_held || !submits) return false;
  cx.stop_propagation();
  view.commit(cx);
  return true;
}
