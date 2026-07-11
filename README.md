# Audio CD Image Creator

Browser-based tool for building shareable **Red Book** audio CD images from local files. Pick a folder or multiple audio files, review and edit metadata, preview the CUE sheet, and download a `.cue` + `.bin` image packaged in a ZIP.

**All processing runs in your browser.** Files are never uploaded to a server.

## Features

- **Source selection** — folder picker, multi-file picker, or drag-and-drop
- **Metadata** — reads title, artist, album, genre, year, composer, duration, and embedded cover art via `music-metadata`
- **Editable disc & tracks** — change album fields, per-track title/artist, cover art, and track order before building
- **Capacity planning** — projected runtime, BIN/ZIP size, and 74-min / 80-min (79:57 Red Book) fit indicators
- **Trim track list** — remove tracks to fit an 80-minute disc
- **CD-Text** (optional, on by default) — writes cdrdao-compatible `CD_TEXT`, `TITLE`, `PERFORMER`, and `SONGWRITER` fields in the CUE sheet
- **Live CUE preview** — inspect and copy the sheet before download
- **High-quality PCM** — decodes to 44.1 kHz / 16-bit stereo with triangular dither, packed into standard 2352-byte CD-DA sectors

## Output

The download is a ZIP containing:

| File | Description |
|------|-------------|
| `*.cue` | CUE sheet (track index, optional CD-Text, configurable path prefix) |
| `*.bin` | Raw Red Book PCM image (all audio baked in) |
| `folder.jpg` | Album cover, if set |
| `covers/NN.jpg` | Per-track covers, when available |

### CUE path prefix

Leave **empty** if the recipient extracts the ZIP and burns with the `.cue` and `.bin` in the same folder:

```cue
FILE "album.bin" BINARY
```

Use a prefix like `AUDIOCD/` only when you want files placed in a subfolder on the recipient's machine:

```cue
FILE "AUDIOCD/album.bin" BINARY
```

## Supported input formats

Decoding uses the Web Audio API (browser-dependent):

- MP3, WAV, OGG, AAC/M4A (typically supported)
- FLAC and others may fail in some browsers

## Limitations

- **80-minute cap** — standard Red Book capacity is ~79:57; the app warns when the projected image exceeds this
- **BIN size** — uncompressed PCM is ~10× larger than MP3; a full CD image can be ~700 MB+ in memory
- **CD-Text on players** — metadata in the CUE sheet is used by capable burners (e.g. cdrdao); whether titles appear on a car stereo depends on the drive/software writing CD-Text subchannels
- **Cover art** — not part of the Red Book image; bundled as separate JPEG files in the ZIP

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

## Workflow

1. Select a folder or audio files
2. Review projected duration/size and edit disc + track metadata
3. Reorder or remove tracks until the image fits your target disc
4. Preview the CUE sheet
5. Click **Create CD image** and save the ZIP
6. Burn with a CUE-aware tool (e.g. cdrdao, ImgBurn, foobar2000)

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router)
- [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) 4
- [music-metadata](https://github.com/Borewit/music-metadata) — tag reading
- [JSZip](https://stuk.github.io/jszip/) — download archive

## Project structure

```
app/              Next.js app shell
components/       UI (creator, track list, CUE preview)
lib/              Metadata, decode, CUE/BIN builder, estimates
```

## License

Private project.
