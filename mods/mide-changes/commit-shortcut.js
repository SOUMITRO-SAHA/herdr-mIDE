// Modified Enter submits only while the commit message itself has focus.
export function handleCommitShortcut(event, cx, view) {
  const modifiers = event.modifiers ?? {};
  if (
    !view.typing ||
    view.view !== "changes" ||
    event.key !== "enter" ||
    event.is_held ||
    !modifiers.control ||
    modifiers.platform ||
    modifiers.shift ||
    modifiers.alt ||
    modifiers.function
  )
    return false;
  cx.stop_propagation();
  view.commit(cx);
  return true;
}
