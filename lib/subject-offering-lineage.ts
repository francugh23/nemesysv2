export function mapCurrentOfferingIdsToActiveIdentities(
  currentOfferingIds: string[],
  eligibleOfferingIds: string[],
  lineage: Array<{ offeringId: string; ancestorOfferingId: string }>,
) {
  const ancestorIdsByOfferingId = new Map<string, Set<string>>();
  for (const { offeringId, ancestorOfferingId } of lineage) {
    const ancestors = ancestorIdsByOfferingId.get(offeringId) ?? new Set<string>();
    ancestors.add(ancestorOfferingId);
    ancestorIdsByOfferingId.set(offeringId, ancestors);
  }
  return [...new Set(currentOfferingIds.flatMap((currentOfferingId) => {
    const activeIdentity = eligibleOfferingIds.find((offeringId) =>
      offeringId === currentOfferingId || ancestorIdsByOfferingId.get(offeringId)?.has(currentOfferingId));
    return activeIdentity ? [activeIdentity] : [];
  }))];
}
