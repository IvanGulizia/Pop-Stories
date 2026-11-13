import { CustomSoundEditParams } from '../types';

export const DEFAULT_SOUND_EDIT_PARAMS: CustomSoundEditParams = {
  trimStart: 0,
  trimEnd: 1,
  fadeIn: 0,
  fadeOut: 0,
  attack: 0,
  decay: 0,
  sustain: 1,
  release: 0,
  gain: 1,
  playbackRate: 1,
};

export async function decodeDataUrlToAudioBuffer(dataUrl: string): Promise<AudioBuffer> {
  const res = await fetch(dataUrl);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close().catch(() => {});
  }
}

export function extractWaveformPeaks(buffer: AudioBuffer, bucketCount: number = 140): number[] {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  if (totalSamples === 0) return Array(bucketCount).fill(0);

  const step = Math.max(1, Math.floor(totalSamples / bucketCount));
  const peaks: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor((i / bucketCount) * totalSamples);
    const end = Math.min(totalSamples, start + step);
    let maxVal = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(maxVal);
  }

  return peaks;
}

export function computeEnvelopeMultiplierAt(
  t: number,
  totalDuration: number,
  params: CustomSoundEditParams
): number {
  if (totalDuration <= 0) return 0;
  const clampedT = Math.max(0, Math.min(totalDuration, t));
  const tFromEnd = totalDuration - clampedT;

  // 1. ADSR shape
  const attack = Math.max(0, params.attack);
  const decay = Math.max(0, params.decay);
  const sustain = Math.max(0, Math.min(1, params.sustain));
  const release = Math.max(0, params.release);

  let adsr = sustain;
  if (attack > 0.002 && clampedT < attack) {
    adsr = clampedT / attack;
  } else if (decay > 0.002 && clampedT < attack + decay) {
    const dProgress = (clampedT - attack) / decay;
    adsr = 1 - (1 - sustain) * dProgress;
  }

  if (release > 0.002 && tFromEnd < release) {
    adsr *= Math.max(0, tFromEnd / release);
  }

  // 2. Fade In & Fade Out multipliers
  const fadeIn = Math.max(0, params.fadeIn);
  const fadeOut = Math.max(0, params.fadeOut);

  let fadeMul = 1;
  if (fadeIn > 0.002 && clampedT < fadeIn) {
    fadeMul *= clampedT / fadeIn;
  }
  if (fadeOut > 0.002 && tFromEnd < fadeOut) {
    fadeMul *= Math.max(0, tFromEnd / fadeOut);
  }

  return Math.max(0, Math.min(1, adsr * fadeMul));
}

function buildGainCurve(duration: number, params: CustomSoundEditParams, sampleCount = 256): Float32Array {
  const curve = new Float32Array(sampleCount);
  const gainBoost = Math.max(0.05, Math.min(3, params.gain));
  for (let i = 0; i < sampleCount; i++) {
    const u = i / (sampleCount - 1);
    const t = u * duration;
    const env = computeEnvelopeMultiplierAt(t, duration, params);
    curve[i] = Math.max(0, Math.min(3, env * gainBoost));
  }
  return curve;
}

export function getTrimmedTiming(buffer: AudioBuffer, params: CustomSoundEditParams) {
  const safeStart = Math.max(0, Math.min(0.98, params.trimStart));
  const safeEnd = Math.max(safeStart + 0.02, Math.min(1, params.trimEnd));
  const sourceOffset = safeStart * buffer.duration;
  const sourceDuration = Math.max(0.03, (safeEnd - safeStart) * buffer.duration);
  const playbackRate = Math.max(0.5, Math.min(2, params.playbackRate || 1));
  const outputDuration = Math.max(0.03, sourceDuration / playbackRate);
  return { sourceOffset, sourceDuration, playbackRate, outputDuration };
}

export interface LivePreviewHandle {
  stop: () => void;
  duration: number;
}

export function playEditedAudioPreview(
  buffer: AudioBuffer,
  params: CustomSoundEditParams,
  onEnded?: () => void
): LivePreviewHandle {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const { sourceOffset, sourceDuration, playbackRate, outputDuration } = getTrimmedTiming(buffer, params);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  const gainNode = ctx.createGain();
  const curve = buildGainCurve(outputDuration, params);
  const now = ctx.currentTime;
  gainNode.gain.setValueCurveAtTime(curve, now, outputDuration);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      source.stop();
    } catch {
      // ignore if already stopped
    }
    ctx.close().catch(() => {});
  };

  source.onended = () => {
    cleanup();
    onEnded?.();
  };

  source.start(now, sourceOffset, sourceDuration);

  return {
    duration: outputDuration,
    stop: () => {
      cleanup();
      onEnded?.();
    },
  };
}

function encodeAudioBufferToWavDataUrl(buffer: AudioBuffer): string {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(wavBuffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export async function renderEditedAudioToWavDataUrl(
  buffer: AudioBuffer,
  params: CustomSoundEditParams
): Promise<{ dataUrl: string; duration: number }> {
  const { sourceOffset, sourceDuration, playbackRate, outputDuration } = getTrimmedTiming(buffer, params);
  const sampleRate = buffer.sampleRate || 44100;
  const frameCount = Math.max(1, Math.ceil(outputDuration * sampleRate));
  const numChannels = Math.min(2, Math.max(1, buffer.numberOfChannels));

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const offlineCtx = new OfflineCtx(numChannels, frameCount, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  const gainNode = offlineCtx.createGain();
  const curve = buildGainCurve(outputDuration, params);
  gainNode.gain.setValueCurveAtTime(curve, 0, outputDuration);

  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  source.start(0, sourceOffset, sourceDuration);

  const rendered = await offlineCtx.startRendering();
  const dataUrl = encodeAudioBufferToWavDataUrl(rendered);
  return {
    dataUrl,
    duration: Number(outputDuration.toFixed(2)),
  };
}
