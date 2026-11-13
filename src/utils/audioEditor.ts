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
  reverbMix: 0,
  reverbDecay: 1.2,
  reverbDamping: 0.4,
  delayMix: 0,
  delayTime: 0.22,
  delayFeedback: 0.35,
  filterType: 'none',
  filterFreq: 3200,
  drive: 0,
  reverse: false,
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

export function computeEffectTailDuration(params: CustomSoundEditParams): number {
  const reverbMix = Math.max(0, Math.min(1, params.reverbMix ?? 0));
  const reverbDecay = Math.max(0.2, Math.min(3.5, params.reverbDecay ?? 1.2));
  const revTail = reverbMix > 0.01 ? Math.min(4.5, reverbDecay * 1.15) : 0;

  const delayMix = Math.max(0, Math.min(1, params.delayMix ?? 0));
  const delayTime = Math.max(0.04, Math.min(0.8, params.delayTime ?? 0.22));
  const delayFeedback = Math.max(0, Math.min(0.85, params.delayFeedback ?? 0.35));
  const echoCount = Math.max(2, Math.ceil(Math.log(0.005) / Math.log(Math.max(0.05, delayFeedback))));
  const delTail = delayMix > 0.01 ? Math.min(4.0, delayTime * echoCount) : 0;

  const rawTail = Math.max(revTail, delTail);
  return rawTail > 0 ? Number((rawTail + 0.08).toFixed(3)) : 0;
}

export function computeNormalizedGain(buffer: AudioBuffer, params: CustomSoundEditParams): number {
  const safeStart = Math.max(0, Math.min(0.98, params.trimStart));
  const safeEnd = Math.max(safeStart + 0.02, Math.min(1, params.trimEnd));
  const startSample = Math.floor(safeStart * buffer.length);
  const endSample = Math.min(buffer.length, Math.ceil(safeEnd * buffer.length));

  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = startSample; i < endSample; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak < 0.01) return 2.5;
  return Math.max(0.2, Math.min(2.5, Number((0.95 / peak).toFixed(2))));
}

function createReversedSliceAudioBuffer(
  ctx: BaseAudioContext,
  sourceBuffer: AudioBuffer,
  sourceOffset: number,
  sourceDuration: number
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(sourceOffset * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.ceil((sourceOffset + sourceDuration) * sampleRate));
  const frameCount = Math.max(1, endSample - startSample);
  const channels = sourceBuffer.numberOfChannels;

  const outBuffer = ctx.createBuffer(channels, frameCount, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const src = sourceBuffer.getChannelData(ch);
    const dst = outBuffer.getChannelData(ch);
    for (let i = 0; i < frameCount; i++) {
      dst[i] = src[endSample - 1 - i] ?? 0;
    }
  }
  return outBuffer;
}

function createReverbImpulseResponse(
  ctx: BaseAudioContext,
  decaySeconds: number,
  damping: number
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = Math.max(0.25, Math.min(4.0, decaySeconds * 1.1));
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const ir = ctx.createBuffer(2, length, sampleRate);
  const clampedDamping = Math.max(0, Math.min(1, damping));
  const lpAlpha = 1 - clampedDamping * 0.88;

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      // Enveloppe exponentielle naturelle avec légère montée initiale (10ms)
      const env = Math.pow(1 - progress, 2.4) * Math.exp(-2.8 * progress);
      const white = Math.random() * 2 - 1;
      const filtered = prev + lpAlpha * (white - prev);
      prev = filtered;
      data[i] = filtered * env * 0.7;
    }
  }
  return ir;
}

function createWaveShaperCurve(drive: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const amount = Math.max(0.01, Math.min(1, drive));
  const driveGain = 1 + amount * 9;
  const norm = Math.tanh(driveGain);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * driveGain) / norm;
  }
  return curve;
}

function scheduleAudioGraph(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  params: CustomSoundEditParams,
  startTime: number
) {
  const { sourceOffset, sourceDuration, playbackRate, outputDuration } = getTrimmedTiming(buffer, params);
  const tailDuration = computeEffectTailDuration(params);
  const totalDuration = outputDuration + tailDuration;

  const source = ctx.createBufferSource();
  source.playbackRate.value = playbackRate;

  if (params.reverse) {
    const revBuffer = createReversedSliceAudioBuffer(ctx, buffer, sourceOffset, sourceDuration);
    source.buffer = revBuffer;
    source.start(startTime, 0, revBuffer.duration);
  } else {
    source.buffer = buffer;
    source.start(startTime, sourceOffset, sourceDuration);
  }

  // 1. Enveloppe ADSR + Fades + Gain
  const envGain = ctx.createGain();
  const curve = buildGainCurve(outputDuration, params);
  envGain.gain.setValueCurveAtTime(curve, startTime, outputDuration);
  // Assurer le silence absolu sur la branche sèche après outputDuration pour laisser chanter la queue des effets
  envGain.gain.setValueAtTime(0, startTime + outputDuration + 0.002);

  let currentNode: AudioNode = envGain;
  source.connect(envGain);

  // 2. Saturation douce (Drive)
  const drive = Math.max(0, Math.min(1, params.drive ?? 0));
  if (drive > 0.01) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = createWaveShaperCurve(drive);
    shaper.oversample = '2x';
    currentNode.connect(shaper);
    currentNode = shaper;
  }

  // 3. Filtre Tonalité (Lowpass / Highpass)
  const filterType = params.filterType || 'none';
  if (filterType === 'lowpass' || filterType === 'highpass') {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = Math.max(120, Math.min(16000, params.filterFreq ?? 3200));
    filter.Q.value = 0.85;
    currentNode.connect(filter);
    currentNode = filter;
  }

  // 4. Bus Master avec fondu de queue anti-clic
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1, startTime);
  if (totalDuration > 0.05) {
    const fadeTailStart = startTime + Math.max(0, totalDuration - 0.035);
    masterGain.gain.setValueAtTime(1, fadeTailStart);
    masterGain.gain.linearRampToValueAtTime(0, startTime + totalDuration);
  }
  masterGain.connect(ctx.destination);

  // Signal sec (Dry)
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;
  currentNode.connect(dryGain);
  dryGain.connect(masterGain);

  // 5. Réverbe à convolution stéréo (Wet)
  const reverbMix = Math.max(0, Math.min(1, params.reverbMix ?? 0));
  if (reverbMix > 0.01) {
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulseResponse(
      ctx,
      params.reverbDecay ?? 1.2,
      params.reverbDamping ?? 0.4
    );
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = reverbMix * 1.15;
    currentNode.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(masterGain);
  }

  // 6. Écho / Delay avec Feedback
  const delayMix = Math.max(0, Math.min(1, params.delayMix ?? 0));
  if (delayMix > 0.01) {
    const delayTime = Math.max(0.04, Math.min(0.8, params.delayTime ?? 0.22));
    const delayFeedback = Math.max(0, Math.min(0.85, params.delayFeedback ?? 0.35));

    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.value = delayTime;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = delayFeedback;

    const delayWet = ctx.createGain();
    delayWet.gain.value = delayMix;

    currentNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(masterGain);
  }

  return { source, outputDuration, tailDuration, totalDuration };
}

export interface LivePreviewHandle {
  stop: () => void;
  duration: number;
  totalDuration: number;
}

export function playEditedAudioPreview(
  buffer: AudioBuffer,
  params: CustomSoundEditParams,
  onEnded?: () => void
): LivePreviewHandle {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;
  const { source, outputDuration, totalDuration } = scheduleAudioGraph(ctx, buffer, params, now);

  let cleaned = false;
  let endTimer: number | null = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (endTimer !== null) {
      window.clearTimeout(endTimer);
      endTimer = null;
    }
    try {
      source.stop();
    } catch {
      // ignore if already stopped
    }
    ctx.close().catch(() => {});
  };

  // Ne PAS fermer le contexte sur source.onended : attendre la fin complète de la queue Réverbe / Écho !
  endTimer = window.setTimeout(() => {
    cleanup();
    onEnded?.();
  }, Math.ceil(totalDuration * 1000) + 45);

  return {
    duration: outputDuration,
    totalDuration,
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
  const sampleRate = buffer.sampleRate || 44100;
  const numChannels = Math.min(2, Math.max(1, buffer.numberOfChannels));
  const { outputDuration } = getTrimmedTiming(buffer, params);
  const tailDuration = computeEffectTailDuration(params);
  const totalDuration = outputDuration + tailDuration;
  const frameCount = Math.max(1, Math.ceil(totalDuration * sampleRate));

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const offlineCtx = new OfflineCtx(numChannels, frameCount, sampleRate);
  scheduleAudioGraph(offlineCtx, buffer, params, 0);

  const rendered = await offlineCtx.startRendering();
  const dataUrl = encodeAudioBufferToWavDataUrl(rendered);
  return {
    dataUrl,
    duration: Number(totalDuration.toFixed(2)),
  };
}
