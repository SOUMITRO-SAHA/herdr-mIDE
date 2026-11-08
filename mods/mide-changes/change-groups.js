// Group by whether a file is newly created, independently of its stage state.
export function groupChanges(files) {
  return {
    tracked: files.filter((file) => !file.created),
    untracked: files.filter((file) => file.created),
  };
}
