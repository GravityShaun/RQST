type ContributorLike = {
  user_id: number;
};

export function countUniqueContributors(
  contributorCount: number | null | undefined,
  contributors: ContributorLike[] | null | undefined,
): number {
  if (contributorCount != null) {
    return contributorCount;
  }

  if (!contributors?.length) {
    return 0;
  }

  return new Set(contributors.map((contributor) => contributor.user_id)).size;
}
