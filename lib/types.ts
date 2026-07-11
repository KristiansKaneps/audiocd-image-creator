export interface AudioTrack {
  id: string;
  file: File;
  title: string;
  artist: string;
  album: string;
  composer: string;
  genre: string;
  year: string;
  durationMs: number | null;
  coverBlob: Blob | null;
}

export interface AlbumMeta {
  title: string;
  artist: string;
  genre: string;
  year: string;
  coverBlob: Blob | null;
}

export interface BuildOptions {
  pathPrefix: string;
  imageBasename: string;
  pregapSeconds: number;
  albumTitle: string;
  albumArtist: string;
  enableCdText: boolean;
  albumCoverBlob: Blob | null;
}

export interface BuildProgress {
  phase: "decoding" | "packing" | "zipping";
  current: number;
  total: number;
  message: string;
}

export interface CdImageEstimate {
  trackCount: number;
  missingDurationCount: number;
  audioDurationMs: number;
  pregapDurationMs: number;
  totalDurationMs: number;
  binSizeBytes: number;
  cueSizeBytes: number;
  coverSizeBytes: number;
  zipSizeEstimateBytes: number;
  fits74MinCd: boolean;
  fits80MinCd: boolean;
  fits80MinLabel: boolean;
  isComplete: boolean;
}
