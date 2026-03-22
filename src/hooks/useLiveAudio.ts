import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { arrayBufferToBase64, base64ToArrayBuffer, floatTo16BitPCM } from '../lib/audio-utils';

interface LiveAudioProps {
  systemInstruction: string;
  onInterrupted?: () => void;
  onTranscription?: (text: string, role: 'user' | 'model') => void;
}

export function useLiveAudio({ systemInstruction, onInterrupted, onTranscription }: LiveAudioProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const isMutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  }, []);

  const stopAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setIsConnected(false);
    setIsSpeaking(false);
    setIsMuted(false);
    isMutedRef.current = false;
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false);
      }
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const pcmData = audioQueueRef.current.shift()!;
    
    // Convert Int16 PCM to Float32 for Web Audio API
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };

    source.start();
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        setError("API Key não encontrada. Verifique as configurações.");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsRecording(true);
            // Send initial prompt for a friendly welcome and introduction
            sessionPromise.then(session => {
              session.sendRealtimeInput({
                text: "Por favor, dê as boas-vindas ao cliente de forma calorosa e amigável, e apresente a Nutsafe brevemente como sua primeira mensagem."
              });
            });
          },
          onmessage: async (message) => {
            console.log("Live API Message:", message);
            
            if ((message.serverContent as any)?.modelTurn?.parts) {
              for (const part of (message.serverContent as any).modelTurn.parts) {
                if (part.inlineData?.data) {
                  const base64Audio = part.inlineData.data;
                  const arrayBuffer = base64ToArrayBuffer(base64Audio);
                  audioQueueRef.current.push(new Int16Array(arrayBuffer));
                  playNextInQueue();
                }
                if (part.text) {
                  onTranscription?.(part.text, 'model');
                }
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Model Interrupted");
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              setIsSpeaking(false);
              onInterrupted?.();
            }

            if ((message.serverContent as any)?.userTurn?.parts) {
              for (const part of (message.serverContent as any).userTurn.parts) {
                if (part.text) {
                  onTranscription?.(part.text, 'user');
                }
              }
            }
          },
          onclose: (event: any) => {
            console.log("Live API Closed:", event);
            stopAudio();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            setError("Erro na conexão com a IA: " + (err.message || "Erro desconhecido"));
            stopAudio();
          }
        }
      });

      const session = await sessionPromise;
      sessionRef.current = session;
      console.log("Session established");

      // Setup Audio Capture
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (sessionRef.current && !isMutedRef.current) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcm16.buffer);
          
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Não foi possível acessar o microfone ou conectar à IA.");
      stopAudio();
    }
  }, [systemInstruction, isConnected, onInterrupted, onTranscription, playNextInQueue, stopAudio]);

  return { connect, stopAudio, isConnected, isRecording, isSpeaking, isMuted, toggleMute, error };
}
