import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSceneStore } from '../store/useSceneStore';
import { CustomSound, CustomSoundEditParams } from '../types';
import {
  Mic,
  Square,
  Play,
  Pause,
  Upload,
  Trash2,
  Check,
  X,
  Volume2,
  Music,
  Scissors,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import {
  DEFAULT_SOUND_EDIT_PARAMS,
  LivePreviewHandle,
  computeEnvelopeMultiplierAt,
  decodeDataUrlToAudioBuffer,
  extractWaveformPeaks,
  getTrimmedTiming,
  playEditedAudioPreview,
  renderEditedAudioToWavDataUrl,
} from '../utils/audioEditor';

interface SoundRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSound?: (sound: CustomSound) => void;
}

interface StudioSession {
  editingSoundId?: string;
  source: 'mic' | 'upload';
  name: string;
  rawDataUrl: string;
  buffer: AudioBuffer;
  peaks: number[];
  params: CustomSoundEditParams;
}

export function SoundRecorderModal({ isOpen, onClose, onSelectSound }: SoundRecorderModalProps) {
  const customSounds = useSceneStore((state) => state.customSounds);
  const addCustomSound = useSceneStore((state) => state.addCustomSound);
  const updateCustomSound = useSceneStore((state) => state.updateCustomSound);
  const deleteCustomSound = useSceneStore((state) => state.deleteCustomSound);

  const [activeTab, setActiveTab] = useState<'mic' | 'upload' | 'studio' | 'library'>('mic');

  // Mic recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedDataUrl, setRecordedDataUrl] = useState<string | null>(null);
  const [recordedName, setRecordedName] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Studio session state
  const [studio, setStudio] = useState<StudioSession | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isBaking, setIsBaking] = useState(false);
  const [isStudioPlaying, setIsStudioPlaying] = useState(false);
  const [playheadProgress, setPlayheadProgress] = useState<number | null>(null); // 0..1 within trimmed range
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

  // Library playback state
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const studioPreviewRef = useRef<LivePreviewHandle | null>(null);
  const playheadRafRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopStudioPlayback = () => {
    if (playheadRafRef.current) {
      cancelAnimationFrame(playheadRafRef.current);
      playheadRafRef.current = null;
    }
    if (studioPreviewRef.current) {
      studioPreviewRef.current.stop();
      studioPreviewRef.current = null;
    }
    setIsStudioPlaying(false);
    setPlayheadProgress(null);
  };

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      stopStudioPlayback();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopStudioPlayback();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingId(null);
    }
  }, [isOpen]);

  // Dessin interactif de la forme d'onde + région de découpe + courbe ADSR/Fades
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !studio || activeTab !== 'studio') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fond subtil
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Ligne centrale
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    const { peaks, params, buffer } = studio;
    const startX = params.trimStart * W;
    const endX = params.trimEnd * W;

    // Barres de forme d'onde
    const barW = W / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const normX = (i + 0.5) / peaks.length;
      const inSelection = normX >= params.trimStart && normX <= params.trimEnd;
      const amp = Math.max(0.04, Math.min(1, peaks[i] * Math.min(1.8, params.gain)));
      const barH = amp * (H * 0.78);
      const x = i * barW;
      const y = (H - barH) / 2;

      ctx.fillStyle = inSelection ? '#818cf8' : 'rgba(100, 116, 139, 0.35)';
      ctx.fillRect(x + 0.5, y, Math.max(1.5, barW - 1.2), barH);
    }

    // Zones masquées hors sélection
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    if (startX > 0) ctx.fillRect(0, 0, startX, H);
    if (endX < W) ctx.fillRect(endX, 0, W - endX, H);

    // Courbe d'enveloppe ADSR + Fade In / Fade Out par-dessus la zone sélectionnée
    const { outputDuration } = getTrimmedTiming(buffer, params);
    const selW = Math.max(4, endX - startX);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const steps = 96;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const t = u * outputDuration;
      const env = computeEnvelopeMultiplierAt(t, outputDuration, params);
      const px = startX + u * selW;
      const py = H - 8 - env * (H - 18);
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Poignées de découpe Start & End
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, H);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, H);
    ctx.stroke();

    // Badges poignées
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(Math.max(0, startX - 4), 0, 8, 16);
    ctx.fillRect(Math.min(W - 8, endX - 4), H - 16, 8, 16);

    // Tête de lecture animée
    if (playheadProgress !== null) {
      const playX = startX + playheadProgress * selW;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, H);
      ctx.stroke();
    }
  }, [studio, activeTab, playheadProgress]);

  if (!isOpen) return null;

  const openAudioInStudio = async ({
    rawDataUrl,
    name,
    source,
    editingSoundId,
    initialParams,
  }: {
    rawDataUrl: string;
    name: string;
    source: 'mic' | 'upload';
    editingSoundId?: string;
    initialParams?: CustomSoundEditParams;
  }) => {
    setErrorMessage(null);
    setIsDecoding(true);
    stopStudioPlayback();
    try {
      const buffer = await decodeDataUrlToAudioBuffer(rawDataUrl);
      const peaks = extractWaveformPeaks(buffer, 140);
      setStudio({
        editingSoundId,
        source,
        name,
        rawDataUrl,
        buffer,
        peaks,
        params: initialParams ? { ...DEFAULT_SOUND_EDIT_PARAMS, ...initialParams } : { ...DEFAULT_SOUND_EDIT_PARAMS },
      });
      setActiveTab('studio');
    } catch (err) {
      console.error('Decode audio failed:', err);
      setErrorMessage("Impossible de décoder ce fichier audio dans le Studio.");
    } finally {
      setIsDecoding(false);
    }
  };

  // Start microphone recording
  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedDataUrl(null);
    setRecordDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (err) {
        console.warn('Audio visualization not supported', err);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stopRecordingCleanup();
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setRecordedDataUrl(base64);
          setRecordedName(`Son vocal #${customSounds.length + 1}`);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordDuration(Math.round((Date.now() - startTime) / 1000));
      }, 200);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? "L'accès au microphone a été refusé. Veuillez autoriser le microphone dans votre navigateur."
          : "Impossible d'accéder au microphone."
      );
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
    }
  };

  // Save the recorded sound directly without editing
  const handleSaveRecordedDirect = () => {
    if (!recordedDataUrl) return;
    const soundId = addCustomSound({
      name: recordedName.trim() || `Son vocal #${customSounds.length + 1}`,
      dataUrl: recordedDataUrl,
      rawDataUrl: recordedDataUrl,
      duration: recordDuration,
      source: 'mic',
    });
    setRecordedDataUrl(null);
    setRecordDuration(0);
    setRecordedName('');

    if (onSelectSound) {
      const saved = useSceneStore.getState().customSounds.find((s) => s.id === soundId);
      if (saved) onSelectSound(saved);
      onClose();
    } else {
      setActiveTab('library');
    }
  };

  // Handle local audio file upload -> Open in Studio Audio directly
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|webm|aac)$/i)) {
      setErrorMessage('Format non supporté. Veuillez choisir un fichier MP3, WAV, OGG ou WebM.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32);
      openAudioInStudio({
        rawDataUrl: base64,
        name: cleanName || `Son importé #${customSounds.length + 1}`,
        source: 'upload',
      });
    };
    reader.onerror = () => {
      setErrorMessage('Erreur lors de la lecture du fichier audio.');
    };
    reader.readAsDataURL(file);
  };

  // Studio live preview
  const handleToggleStudioPreview = () => {
    if (!studio) return;
    if (isStudioPlaying) {
      stopStudioPlayback();
      return;
    }

    const handle = playEditedAudioPreview(studio.buffer, studio.params, () => {
      setIsStudioPlaying(false);
      setPlayheadProgress(null);
      if (playheadRafRef.current) {
        cancelAnimationFrame(playheadRafRef.current);
        playheadRafRef.current = null;
      }
      studioPreviewRef.current = null;
    });

    studioPreviewRef.current = handle;
    setIsStudioPlaying(true);

    const startTs = performance.now();
    const animatePlayhead = (now: number) => {
      const elapsed = (now - startTs) / 1000;
      const prog = Math.min(1, elapsed / Math.max(0.05, handle.duration));
      setPlayheadProgress(prog);
      if (prog < 1 && studioPreviewRef.current) {
        playheadRafRef.current = requestAnimationFrame(animatePlayhead);
      }
    };
    playheadRafRef.current = requestAnimationFrame(animatePlayhead);
  };

  // Save / Bake processed WAV from Studio
  const handleSaveStudioSound = async () => {
    if (!studio) return;
    stopStudioPlayback();
    setIsBaking(true);
    setErrorMessage(null);
    try {
      const { dataUrl, duration } = await renderEditedAudioToWavDataUrl(studio.buffer, studio.params);
      const finalName = studio.name.trim() || `Son #${customSounds.length + 1}`;

      let savedSoundId = studio.editingSoundId;
      if (savedSoundId) {
        updateCustomSound(savedSoundId, {
          name: finalName,
          dataUrl,
          rawDataUrl: studio.rawDataUrl,
          editParams: studio.params,
          duration,
        });
      } else {
        savedSoundId = addCustomSound({
          name: finalName,
          dataUrl,
          rawDataUrl: studio.rawDataUrl,
          editParams: studio.params,
          duration,
          source: studio.source,
        });
      }

      setRecordedDataUrl(null);
      setRecordDuration(0);
      setStudio(null);

      if (onSelectSound && savedSoundId) {
        const saved = useSceneStore.getState().customSounds.find((s) => s.id === savedSoundId);
        if (saved) onSelectSound(saved);
        onClose();
      } else {
        setActiveTab('library');
      }
    } catch (err) {
      console.error('Audio bake error:', err);
      setErrorMessage("Erreur lors du rendu audio final.");
    } finally {
      setIsBaking(false);
    }
  };

  // Play audio preview in Library
  const playSoundPreview = (url: string, id: string) => {
    if (playingId === id) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    try {
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setPlayingId(id);
      audio.onended = () => {
        setPlayingId(null);
        currentAudioRef.current = null;
      };
      audio.play().catch(() => {
        setPlayingId(null);
      });
    } catch {
      setPlayingId(null);
    }
  };

  const updateStudioParams = (partial: Partial<CustomSoundEditParams>) => {
    setStudio((prev) => {
      if (!prev) return null;
      return { ...prev, params: { ...prev.params, ...partial } };
    });
  };

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!studio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const distStart = Math.abs(u - studio.params.trimStart);
    const distEnd = Math.abs(u - studio.params.trimEnd);
    const handle = distStart <= distEnd ? 'start' : 'end';
    setDraggingHandle(handle);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (handle === 'start') {
      updateStudioParams({ trimStart: Math.min(studio.params.trimEnd - 0.03, u) });
    } else {
      updateStudioParams({ trimEnd: Math.max(studio.params.trimStart + 0.03, u) });
    }
  };

  const handleWaveformPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingHandle || !studio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (draggingHandle === 'start') {
      updateStudioParams({ trimStart: Math.min(studio.params.trimEnd - 0.03, u) });
    } else {
      updateStudioParams({ trimEnd: Math.max(studio.params.trimStart + 0.03, u) });
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
      style={{ isolation: 'isolate' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Sound Studio — Enregistreur &amp; Éditeur Audio
              </h2>
              <p className="text-xs text-slate-400">
                Enregistrez, découpez (Trim), appliquez des fondus et une enveloppe ADSR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl my-3.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('mic')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'mic'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Micro</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer</span>
          </button>
          <button
            type="button"
            disabled={!studio}
            onClick={() => studio && setActiveTab('studio')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'studio'
                ? 'bg-white text-indigo-700 shadow-xs cursor-pointer'
                : studio
                ? 'text-slate-600 hover:text-slate-800 cursor-pointer'
                : 'text-slate-400 opacity-50 cursor-not-allowed'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Studio (ADSR)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'library'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Mes Sons ({customSounds.length})</span>
          </button>
        </div>

        {/* Error / Decoding status */}
        {errorMessage && (
          <div className="p-3 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl shrink-0">
            {errorMessage}
          </div>
        )}
        {isDecoding && (
          <div className="p-3 mb-3 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-2xl shrink-0 text-center">
            Analyse de la forme d'onde audio en cours...
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: MICROPHONE RECORDING */}
          {activeTab === 'mic' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-5 text-center">
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <div
                    className="absolute rounded-full bg-rose-500/20 transition-transform duration-75"
                    style={{
                      width: `${100 + audioLevel * 0.8}px`,
                      height: `${100 + audioLevel * 0.8}px`,
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-300 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-8 h-8 fill-current" />
                      <span className="text-[10px] font-black uppercase mt-1">Arrêter</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8" />
                      <span className="text-[10px] font-black uppercase mt-1">Parler</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800">
                  {isRecording ? `Enregistrement en cours : ${recordDuration}s` : 'Appuyez pour enregistrer'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isRecording
                    ? 'Parlez ou faites un bruitage près du micro'
                    : 'Vous pourrez ensuite découper le son et ajuster son enveloppe ADSR'}
                </div>
              </div>

              {recordedDataUrl && !isRecording && (
                <div className="w-full bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">
                      Aperçu de votre son ({recordDuration}s)
                    </span>
                    <button
                      type="button"
                      onClick={() => playSoundPreview(recordedDataUrl, 'preview-rec')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      {playingId === 'preview-rec' ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Écouter</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={recordedName}
                    onChange={(e) => setRecordedName(e.target.value)}
                    placeholder="Nom du son (ex: Cri de victoire)..."
                    className="w-full px-3 py-2 bg-white rounded-xl border border-indigo-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setRecordedDataUrl(null);
                        setRecordedName('');
                      }}
                      className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Recommencer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openAudioInStudio({
                          rawDataUrl: recordedDataUrl,
                          name: recordedName.trim() || `Son vocal #${customSounds.length + 1}`,
                          source: 'mic',
                        })
                      }
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Éditer / Moduler (Studio)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRecordedDirect}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Enregistrer brut</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <label className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/40 rounded-3xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform mb-3">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Choisir un fichier audio à importer &amp; éditer
                </div>
                <div className="text-xs text-slate-400 mt-1 max-w-xs">
                  MP3, WAV, OGG ou WebM — S'ouvrira directement dans le Studio pour découpe et ADSR.
                </div>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* TAB 3: SOUND STUDIO (WAVEFORM TRIM + FADES + ADSR + PITCH/GAIN) */}
          {activeTab === 'studio' && studio && (() => {
            const { outputDuration } = getTrimmedTiming(studio.buffer, studio.params);
            const p = studio.params;
            return (
              <div className="space-y-3.5 pb-1">
                {/* Nom + Barre lecture */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={studio.name}
                    onChange={(e) => setStudio({ ...studio, name: e.target.value })}
                    placeholder="Nom du son..."
                    className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleToggleStudioPreview}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                      isStudioPlaying
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isStudioPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Écouter</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStudioParams({ ...DEFAULT_SOUND_EDIT_PARAMS })}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                    title="Réinitialiser tous les effets"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Forme d'onde interactive */}
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                  <canvas
                    ref={waveformCanvasRef}
                    width={580}
                    height={120}
                    onPointerDown={handleWaveformPointerDown}
                    onPointerMove={handleWaveformPointerMove}
                    onPointerUp={() => setDraggingHandle(null)}
                    onPointerCancel={() => setDraggingHandle(null)}
                    className="w-full h-28 cursor-ew-resize block"
                  />
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 text-[10px] font-mono text-slate-300 border-t border-slate-800">
                    <span>
                      Début: {(p.trimStart * studio.buffer.duration).toFixed(2)}s • Fin:{' '}
                      {(p.trimEnd * studio.buffer.duration).toFixed(2)}s
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Durée finale : {outputDuration.toFixed(2)}s
                    </span>
                  </div>
                </div>

                {/* Section Découpe (Trim) */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-amber-600" />
                    <span>1. Découpe (Trim)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                        <span>Point d'entrée</span>
                        <span className="font-mono text-amber-600">{Math.round(p.trimStart * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.01, p.trimEnd - 0.03)}
                        step={0.01}
                        value={p.trimStart}
                        onChange={(e) => updateStudioParams({ trimStart: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                        <span>Point de sortie</span>
                        <span className="font-mono text-amber-600">{Math.round(p.trimEnd * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={Math.min(0.99, p.trimStart + 0.03)}
                        max={1}
                        step={0.01}
                        value={p.trimEnd}
                        onChange={(e) => updateStudioParams({ trimEnd: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Section Fondus & Modulation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      2. Fondus (Fade In / Out)
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Fade In</span>
                        <span className="font-mono text-emerald-600">{p.fadeIn.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.2, outputDuration * 0.8)}
                        step={0.02}
                        value={p.fadeIn}
                        onChange={(e) => updateStudioParams({ fadeIn: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Fade Out</span>
                        <span className="font-mono text-emerald-600">{p.fadeOut.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.2, outputDuration * 0.8)}
                        step={0.02}
                        value={p.fadeOut}
                        onChange={(e) => updateStudioParams({ fadeOut: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-indigo-600" />
                      <span>3. Gain &amp; Vitesse / Pitch</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Volume (Gain)</span>
                        <span className="font-mono text-indigo-600">{Math.round(p.gain * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={2.5}
                        step={0.05}
                        value={p.gain}
                        onChange={(e) => updateStudioParams({ gain: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>Vitesse / Pitch</span>
                        <span className="font-mono text-indigo-600">{p.playbackRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={p.playbackRate}
                        onChange={(e) => updateStudioParams({ playbackRate: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Section Enveloppe ADSR */}
                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    4. Enveloppe ADSR (Attack • Decay • Sustain • Release)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Attack</span>
                        <span className="font-mono text-emerald-700">{p.attack.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.2, outputDuration * 0.7)}
                        step={0.02}
                        value={p.attack}
                        onChange={(e) => updateStudioParams({ attack: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Decay</span>
                        <span className="font-mono text-emerald-700">{p.decay.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.2, outputDuration * 0.7)}
                        step={0.02}
                        value={p.decay}
                        onChange={(e) => updateStudioParams({ decay: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Sustain</span>
                        <span className="font-mono text-emerald-700">{Math.round(p.sustain * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={p.sustain}
                        onChange={(e) => updateStudioParams({ sustain: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-700">
                        <span>Release</span>
                        <span className="font-mono text-emerald-700">{p.release.toFixed(2)}s</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.2, outputDuration * 0.8)}
                        step={0.02}
                        value={p.release}
                        onChange={(e) => updateStudioParams({ release: parseFloat(e.target.value) })}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Validation Studio */}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      stopStudioPlayback();
                      setStudio(null);
                      setActiveTab('library');
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={isBaking}
                    onClick={handleSaveStudioSound}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {isBaking
                        ? 'Encodage audio...'
                        : studio.editingSoundId
                        ? 'Mettre à jour le son'
                        : 'Enregistrer dans Mes Sons'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* TAB 4: LIBRARY OF SAVED SOUNDS */}
          {activeTab === 'library' && (
            <div className="space-y-2">
              {customSounds.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <div className="text-3xl">🎵</div>
                  <div className="text-xs font-bold text-slate-600">Aucun son enregistré pour le moment</div>
                  <p className="text-xs text-slate-400">
                    Enregistrez votre voix ou importez des fichiers MP3/WAV pour les retrouver ici.
                  </p>
                </div>
              ) : (
                customSounds.map((sound) => {
                  const isPlaying = playingId === sound.id;
                  return (
                    <div
                      key={sound.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => playSoundPreview(sound.dataUrl, sound.id)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            isPlaying
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:text-indigo-600'
                          }`}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{sound.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{sound.source === 'mic' ? '🎤 Micro' : '📁 Importé'}</span>
                            {sound.duration ? <span>• {sound.duration}s</span> : null}
                            {sound.editParams ? (
                              <span className="text-emerald-600 font-bold">• Modifié Studio</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openAudioInStudio({
                              rawDataUrl: sound.rawDataUrl || sound.dataUrl,
                              name: sound.name,
                              source: sound.source,
                              editingSoundId: sound.id,
                              initialParams: sound.editParams,
                            })
                          }
                          className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold text-xs rounded-xl border border-slate-200 hover:border-amber-300 flex items-center gap-1 cursor-pointer"
                          title="Découper / Moduler (ADSR & Fade)"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Éditer</span>
                        </button>
                        {onSelectSound && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSound(sound);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 cursor-pointer"
                          >
                            Sélectionner
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteCustomSound(sound.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Supprimer ce son"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
