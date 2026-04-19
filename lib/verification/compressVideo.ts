/**
 * Video is recorded at 480p with a short max duration (see K3Liveness) to limit payload size.
 * For further compression, integrate ffmpeg-kit or a server-side transcode in production.
 */
export async function prepareVideoForUpload(localUri: string): Promise<string> {
  return localUri;
}
