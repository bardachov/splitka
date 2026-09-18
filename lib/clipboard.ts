/**
 * Copy to the clipboard; false when the browser refuses — an insecure context,
 * an old Safari, or a denied permission all land here.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
