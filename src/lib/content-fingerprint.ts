/** Match the content actually built into a public page, not merely an accepted rebuild trigger. */
export async function contentFingerprint(value: unknown): Promise<string> {
  const json = JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    }
    return item;
  });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
