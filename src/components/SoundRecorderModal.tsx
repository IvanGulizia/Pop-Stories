import React, { useState, useRef, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { CustomSound } from '../types';
import { Mic, Square, Play, Pause, Upload, Trash2, Check, X, Volume2, Music } from 'lucide-react';
import { soundSynth } from '../utils/sound';

interface SoundRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSound?: (sound: CustomSound) => void;
}

export function SoundRecorderModal({ isOpen, onClose, onSelectSound }: SoundRecorderModalProps) {
  const customSounds = useSceneStore((state) => state.customSounds);
  const addCustomSound = useSceneStore((state) => state.addCustomSound);
  const deleteCustomSound = useSceneStore((state) => state.deleteCustomSound);

  const [activeTab, setActiveTab] = useState<'mic' | 'upload' | 'library'>('mic');

  // Mic recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedDataUrl, setRecordedDataUrl] = useState<string | null>(null);
  const [recordedName, setRecordedName] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

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

  if (!isOpen) return null;

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

      // Audio analysis for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

  // Stop microphone recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
    }
  };

  // Save the recorded sound
  const handleSaveRecorded = () => {
    if (!recordedDataUrl) return;
    const soundId = addCustomSound({
      name: recordedName.trim() || `Son vocal #${customSounds.length + 1}`,
      dataUrl: recordedDataUrl,
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

  // Handle local audio file upload
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
      const soundId = addCustomSound({
        name: cleanName,
        dataUrl: base64,
        source: 'upload',
      });

      if (onSelectSound) {
        const saved = useSceneStore.getState().customSounds.find((s) => s.id === soundId);
        if (saved) onSelectSound(saved);
        onClose();
      } else {
        setActiveTab('library');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Erreur lors de la lecture du fichier audio.');
    };
    reader.readAsDataURL(file);
  };

  // Play audio preview
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

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Gestionnaire de Sons
              </h2>
              <p className="text-xs text-slate-400">
                Enregistrez votre voix ou importez des effets sonores
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
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl my-4 shrink-0">
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
            <span>Enregistrer Micro</span>
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
            <span>Importer Fichier</span>
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

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 mb-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl shrink-0">
            {errorMessage}
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB 1: MICROPHONE RECORDING */}
          {activeTab === 'mic' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-5 text-center">
              {/* Mic pulse button */}
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

              {/* Status and timer */}
              <div>
                <div className="text-sm font-bold text-slate-800">
                  {isRecording ? `Enregistrement en cours : ${recordDuration}s` : 'Appuyez pour enregistrer'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isRecording
                    ? 'Parlez ou faites un bruitage près du micro'
                    : 'Effets de saut, voix de personnage, bruitages...'}
                </div>
              </div>

              {/* Recorded preview & Save */}
              {recordedDataUrl && !isRecording && (
                <div className="w-full bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">Aperçu de votre son ({recordDuration}s)</span>
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

                  <div className="flex gap-2 justify-end">
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
                      onClick={handleSaveRecorded}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Ajouter à mes sons</span>
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
                  Choisir un fichier audio
                </div>
                <div className="text-xs text-slate-400 mt-1 max-w-xs">
                  Glissez-déposez ou cliquez pour importer un son au format MP3, WAV, OGG ou WebM.
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

          {/* TAB 3: LIBRARY OF SAVED SOUNDS */}
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
                            <span>{sound.source === 'mic' ? '🎤 Enregistré au micro' : '📁 Importé'}</span>
                            {sound.duration ? <span>• {sound.duration}s</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
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
    </div>
  );
}
