// A system permission prompt can temporarily background the Activity. Capture
// has not started yet; defer the foreground check until the prompt resolves.
export async function foregroundPermission(
  request: () => Promise<void>,
  setPrompt: (visible: boolean) => void,
  ensureCurrentForeground: () => void,
): Promise<void> {
  setPrompt(true);
  try { await request(); }
  finally { setPrompt(false); }
  ensureCurrentForeground();
}
