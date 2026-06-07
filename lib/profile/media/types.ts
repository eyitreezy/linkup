/** Identifies which gallery tile is the primary profile photo. */
export type PrimaryPhotoRef =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; index: number };

export type ProfileVideoDraft = {
  localUri: string | null;
  remoteUrl: string | null;
  mediaId: string | null;
};
