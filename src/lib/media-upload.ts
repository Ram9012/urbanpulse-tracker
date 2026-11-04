/**
 * CivicPulse — Client-side media upload helper.
 *
 * Captured media starts life as a blob:/data: URL (see report.tsx's camera
 * and file-upload handlers). Before a report is submitted, each item is
 * read back out and uploaded to Supabase Storage via /api/media/upload, so
 * the stored report references a real, durable URL instead of a blob URL
 * that dies when the tab closes.
 *
 * If the upload fails (e.g. Supabase Storage isn't configured in this
 * environment yet), the original local URL is used as a fallback so the
 * submit flow still completes.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function uploadMediaItem(
  reportId: string,
  item: { url: string; name: string },
  kind: "evidence" | "resolution",
): Promise<string> {
  try {
    const blob = await (await fetch(item.url)).blob();
    const base64 = arrayBufferToBase64(await blob.arrayBuffer());
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        kind,
        fileName: item.name,
        contentType: blob.type || "application/octet-stream",
        dataBase64: base64,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.url) return data.url as string;
    }
  } catch (err) {
    console.warn("[Media Upload] failed, keeping local URL:", err);
  }
  return item.url;
}

export async function uploadMediaItems(
  reportId: string,
  items: { url: string; name: string }[],
  kind: "evidence" | "resolution",
): Promise<string[]> {
  return Promise.all(items.map((item) => uploadMediaItem(reportId, item, kind)));
}
