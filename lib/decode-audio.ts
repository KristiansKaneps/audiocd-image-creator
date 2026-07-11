import { CDDA_SAMPLE_RATE } from "./constants";

function triangularDither(): number {
  return (Math.random() - Math.random()) * 0.5;
}

function floatToInt16(sample: number): number {
  const scaled = Math.max(-1, Math.min(1, sample)) * 32767;
  const dithered = scaled + triangularDither();
  return Math.max(-32768, Math.min(32767, Math.round(dithered)));
}

function mixToStereo(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const stereo = new Float32Array(length * 2);

  if (buffer.numberOfChannels === 1) {
    const mono = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      stereo[i * 2] = mono[i];
      stereo[i * 2 + 1] = mono[i];
    }
    return stereo;
  }

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  for (let i = 0; i < length; i++) {
    stereo[i * 2] = left[i];
    stereo[i * 2 + 1] = right[i];
  }

  return stereo;
}

async function resampleBuffer(buffer: AudioBuffer): Promise<AudioBuffer> {
  if (buffer.sampleRate === CDDA_SAMPLE_RATE) {
    return buffer;
  }

  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * CDDA_SAMPLE_RATE),
    CDDA_SAMPLE_RATE,
  );

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  return offline.startRendering();
}

export async function decodeFileToCdPcm(file: File): Promise<Int16Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  let decoded: AudioBuffer;

  try {
    decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close();
  }

  const resampled = await resampleBuffer(decoded);
  const stereo = mixToStereo(resampled);
  const pcm = new Int16Array(stereo.length);

  for (let i = 0; i < stereo.length; i++) {
    pcm[i] = floatToInt16(stereo[i]);
  }

  return pcm;
}
