export const routingKeyFor = (eventName: string): string => eventName;

export const aggregateTypeFor = (eventName: string): string => {
  const parts = eventName.split('.');
  if (parts.length < 2) {
    return 'unknown';
  }
  return parts.slice(0, parts.length - 1).join('.');
};
