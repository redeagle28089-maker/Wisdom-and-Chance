export function createCardInstances(cardIds: string[]): string[] {
  const instanceCounts: Record<string, number> = {};
  return cardIds.map(cardId => {
    const baseId = getCardIdFromInstance(cardId);
    const count = instanceCounts[baseId] || 0;
    instanceCounts[baseId] = count + 1;
    return `${baseId}::${count}`;
  });
}

export function getCardIdFromInstance(instanceId: string): string {
  return instanceId.split("::")[0];
}
