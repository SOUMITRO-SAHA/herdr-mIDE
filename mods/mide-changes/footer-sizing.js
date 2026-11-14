// Preserve short names where possible; share any remaining overflow in
// proportion to actual rendered widths rather than character counts.
export function footerNameWidths(available, repository, branch) {
  available = Math.max(0, available);
  repository = Math.max(0, repository);
  branch = Math.max(0, branch);
  const total = repository + branch;
  if (total <= available || total === 0) return { repository, branch };
  if (repository <= available / 2) return { repository, branch: available - repository };
  if (branch <= available / 2) return { repository: available - branch, branch };
  const repoWidth = (available * repository) / total;
  return { repository: repoWidth, branch: available - repoWidth };
}
