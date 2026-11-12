// A file's stage checkbox changes Git state only; opening its diff remains a
// separate action on the file row.
export const toggleStage = (file, shouldStage, cx, actions) => {
  if (shouldStage) actions.stage(file, cx);
  else actions.unstage(file, cx);
};
