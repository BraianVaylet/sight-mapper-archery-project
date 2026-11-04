/**
 * Hands a JSON document to the browser as a file to save (HU-ACC-05). It goes through a Blob and a
 * link that is clicked and removed: no server round trip for the file itself, and nothing stays in
 * the page afterwards.
 */
export function saveJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has been handled: revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
