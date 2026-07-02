/** True when Vercel Blob is available (local .env or Vercel project integration). */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
