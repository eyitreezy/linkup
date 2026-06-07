/**
 * Video is recorded at 720p with a capped duration (see K3Liveness) to balance clarity and upload size.
 * For further compression, integrate ffmpeg-kit or a server-side transcode in production.
 */
export async function prepareVideoForUpload(localUri: string): Promise<string> {
  return localUri;
}
