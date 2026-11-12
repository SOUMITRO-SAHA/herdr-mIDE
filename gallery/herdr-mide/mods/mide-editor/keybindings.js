// Key handling for mide-editor. The save shortcut offers a local default
// without changing or overriding the person's keys.json; future bindings for
// this mod belong here too.
export function handleSaveShortcut(event, cx, editor, platform, getBindings, getLayout) {
  const modifiers = event.modifiers ?? {};
  const mac = platform === "macos";
  if (
    !["macos", "windows", "linux"].includes(platform) ||
    !editor.file ||
    !editor.code ||
    event.key !== "s" ||
    event.is_held ||
    modifiers.shift ||
    modifiers.alt ||
    modifiers.function ||
    (mac ? !modifiers.platform || modifiers.control : !modifiers.control || modifiers.platform)
  )
    return false;

  const aliases = mac ? ["cmd-s", "super-s", "win-s", "secondary-s"] : ["ctrl-s", "secondary-s"];
  const activeLayout = getLayout();
  const conflict = getBindings().some(binding => {
    const section = binding.section;
    const applies =
      section === "global" ||
      section === "mod:mide-editor" ||
      (section.startsWith("layout:") && (!activeLayout || section === `layout:${activeLayout}`));
    const firstChord = binding.keys.trim().split(/\s+/)[0].toLowerCase();
    return applies && aliases.includes(firstChord);
  });
  if (conflict) return false;
  cx.stop_propagation();
  editor.save(cx);
  return true;
}
