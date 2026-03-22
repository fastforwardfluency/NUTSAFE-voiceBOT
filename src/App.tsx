/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Phone, ShieldCheck, Info, MessageSquare, X, FileText, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useLiveAudio } from './hooks/useLiveAudio';
import Markdown from 'react-markdown';

const SYSTEM_INSTRUCTION = `
Você é o consultor sênior virtual da Nutsafe, especialista em Qualidade e Segurança de Alimentos.
Seu tom de voz deve ser profissional, polido e amigável, transmitindo total confiança e expertise técnica.

REGRAS CRÍTICAS:
1. BREVIDADE: Mantenha as respostas curtas (máximo 1 ou 2 frases curtas) para garantir a mínima latência e máxima eficiência.
2. PROFISSIONALISMO AMIGÁVEL: Utilize linguagem corporativa formal, mas seja acolhedor. Evite ser excessivamente robótico.
3. CALL TO ACTION: Sugira o contato pelos canais oficiais (botão abaixo) apenas quando o assunto exigir uma análise mais profunda ou o cliente demonstrar interesse em contratar. NÃO seja insistente.
4. FOCO: Garantia de conformidade regulatória, segurança alimentar e proteção da marca.
5. DADOS DA EMPRESA (APENAS SE PERGUNTADO ESPECIFICAMENTE):
   CNPJ 30.286.650/0001-06
   NUTSAFE QUALIDADE E SEGURANCA DO TRABALHO - ME - CNPJ 30.286.650/0001-06
   O CNPJ da empresa NUTSAFE QUALIDADE E SEGURANCA DO TRABALHO - ME NUTSAFE é 30.286.650/0001-06. Com sede em RIO DE JANEIRO, RJ, possui 7 anos, 11 meses e 2 dias e foi fundada em 20/04/2018. A sua situação cadastral é BAIXADA e sua principal atividade econômica é Atividades de profissionais da nutrição.
   Razão Social: NUTSAFE QUALIDADE E SEGURANCA DO TRABALHO - ME
   Nome Fantasia: NUTSAFE
   Data de fundação: 20/04/2018

CONHECIMENTO DA EMPRESA:
- Nutsafe: Elevando seu Negócio Gastronômico através de Estratégia e Segurança no Rio de Janeiro.
- Missão: Eliminar a distância entre as normas da ANVISA e a realidade operacional, transformando o ambiente e potencializando lucros.
- Soluções Principais:
  * Boas Práticas de Fabricação (BPF): Implementação de protocolos e "Cultura de Qualidade" com visitas técnicas personalizadas.
  * Fichas Técnicas Estratégicas: Padronização de receitas e cálculo de CMV para proteção de margens.
  * Rotulagem Nutricional Avançada: Conformidade com RDC 429/2020 e IN 75/2020 (alérgenos e tabelas).
  * Treinamentos Especializados: Capacitação prática para reduzir rotatividade e riscos de contaminação.
- Diferencial: Abordagem proativa (prevenção de riscos), suporte regular, foco em conformidade + lucratividade (crescimento da marca).
- Visão: Estar entre as cinco maiores empresas de consultoria em segurança alimentar do Rio de Janeiro até 2030.

Exemplo: "Bem-vindo à Nutsafe. Estamos à disposição para assegurar a excelência técnica do seu estabelecimento. Como posso auxiliar na sua conformidade regulatória hoje?"
`;

export default function App() {
  const [transcriptions, setTranscriptions] = useState<{ text: string; role: 'user' | 'model' }[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const handleTranscription = useCallback((text: string, role: 'user' | 'model') => {
    setTranscriptions(prev => [...prev.slice(-20), { text, role }]);
  }, []);

  const generateSummary = async () => {
    if (transcriptions.length === 0) {
      setSummary('Nenhuma conversa registrada para resumir.');
      setShowSummary(true);
      return;
    }

    setIsGeneratingSummary(true);
    setShowSummary(true);
    setSummary('Gerando resumo executivo...');

    try {
      const conversation = transcriptions.map(t => `${t.role === 'user' ? 'Cliente' : 'Consultor'}: ${t.text}`).join('\n');
      
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar resumo');
      }

      const data = await response.json();
      setSummary(data.text || 'Não foi possível gerar o resumo.');
    } catch (err: any) {
      console.error("Error generating summary:", err);
      setSummary(`Erro ao gerar o resumo: ${err.message}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const { connect, stopAudio, isConnected, isRecording, isSpeaking, isMuted, toggleMute, error } = useLiveAudio({
    systemInstruction: SYSTEM_INSTRUCTION,
    onTranscription: handleTranscription,
  });

  const toggleConnection = () => {
    if (isConnected) {
      stopAudio();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4 font-sans text-[#1A1C1E]">
      <div className="w-full max-w-md bg-[#1A1C1E] rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative border border-white/5">
        
        {/* Header */}
        <div className="p-10 pb-6 flex flex-col items-center text-center">
          <div className={`w-full h-16 flex items-center justify-center mb-6 transition-all duration-700 ${
            isSpeaking ? 'scale-105 brightness-125' : 'opacity-90'
          }`}>
            {/* Logo Nutsafe - Image with stylized fallback */}
            <div className="relative flex items-center justify-center w-full">
              <img 
                src="https://firstmatetravels.com/wp-content/uploads/2026/03/logo-NUTSAFE.png" 
                alt="Nutsafe Logo" 
                className="h-12 object-contain opacity-100"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = document.getElementById('logo-fallback');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div id="logo-fallback" className="hidden items-center gap-3">
                <div className="w-10 h-10 bg-[#00C853] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,200,83,0.4)]">
                  <ShieldCheck className="text-white w-6 h-6" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold text-xl tracking-tight leading-none">NUTSAFE</span>
                  <span className="text-[#00C853] text-[8px] font-bold tracking-[0.2em] uppercase mt-1">Consultoria</span>
                </div>
              </div>
            </div>
          </div>
          
          <h1 className="text-white text-xl font-semibold tracking-tight mb-2">Consultor Executivo Nutsafe</h1>
          
          <div className="flex flex-col items-center gap-2">
            <p className={`text-[9px] font-mono uppercase tracking-[0.3em] transition-colors duration-500 ${
              isSpeaking ? 'text-blue-400' : 'text-[#00C853]'
            }`}>
              {isSpeaking ? 'Em Atendimento...' : 'Qualidade e Segurança de Alimentos'}
            </p>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#00C853] animate-pulse' : 'bg-white/20'}`} />
              <span className="text-[7px] font-mono text-white/50 uppercase tracking-widest">
                {isConnected ? (isMuted ? 'Microfone Mutado' : 'Sistema Online') : 'Sistema Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Visualizer Area */}
        <div className="h-40 flex items-center justify-center relative">
          <AnimatePresence mode="wait">
            {isConnected ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5"
              >
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: isSpeaking ? [20, 60, 20] : (isMuted ? [5, 5, 5] : [10, 25, 10]),
                      backgroundColor: isSpeaking ? '#3b82f6' : (isMuted ? '#ef4444' : '#00C853')
                    }}
                    transition={{
                      duration: isSpeaking ? 0.5 : 1.2,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                    className="w-1.5 rounded-full opacity-80"
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/10 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center bg-white/[0.02]">
                  <Mic className="w-6 h-6 opacity-20" />
                </div>
                <span className="text-[8px] uppercase tracking-[0.4em] font-mono opacity-30">Aguardando Início</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-10 pt-0 flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={toggleConnection}
                className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] font-bold text-xs uppercase tracking-widest ${
                  isConnected 
                    ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10' 
                    : 'bg-[#00C853] text-white hover:bg-[#00E676] shadow-[0_20px_40px_-12px_rgba(0,200,83,0.3)]'
                }`}
              >
                {isConnected ? (
                  <>
                    <MicOff size={16} />
                    <span>Encerrar</span>
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    <span>Iniciar</span>
                  </>
                )}
              </button>

              {isConnected && (
                <button
                  onClick={toggleMute}
                  className={`px-6 py-5 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98] border ${
                    isMuted 
                      ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                  }`}
                  title={isMuted ? "Desmutar" : "Mutar"}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="text-white/60 text-[10px] uppercase font-bold tracking-[0.2em] text-center">Fale conosco!</h3>
                <div className="flex flex-col gap-3">
                  <a
                    href="tel:+5521969259000"
                    className="w-full py-4 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-3 hover:bg-blue-500 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.3)] transition-all active:scale-[0.98] font-bold text-xs uppercase tracking-widest"
                  >
                    <Phone size={16} />
                    <span>21 969259000</span>
                  </a>
                  <a
                    href="mailto:contato@nutsafe.com.br"
                    className="w-full py-3 bg-white/5 border border-white/10 text-white/80 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-[10px] font-bold tracking-wider"
                  >
                    contato@nutsafe.com.br
                  </a>
                </div>
              </div>

              <button
                onClick={generateSummary}
                disabled={isGeneratingSummary}
                className="w-full py-4 bg-white/5 border border-white/10 text-white/40 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-[9px] uppercase font-bold tracking-[0.2em] disabled:opacity-50"
              >
                {isGeneratingSummary ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                Resumo da Conversa
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-white/[0.02] p-5 flex justify-center gap-8 border-t border-white/5">
          <div className="flex items-center gap-2 text-white/20 text-[8px] uppercase font-bold tracking-widest">
            <ShieldCheck size={10} className="text-[#00C853]" />
            <span>ISO 22000</span>
          </div>
          <div className="flex items-center gap-2 text-white/20 text-[8px] uppercase font-bold tracking-widest">
            <Info size={10} className="text-[#00C853]" />
            <span>Compliance</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white text-[10px] p-2 rounded-lg text-center animate-bounce">
            {error}
          </div>
        )}

        {/* Summary Overlay */}
        <AnimatePresence>
          {showSummary && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-0 bg-[#151619] z-50 flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-white font-bold uppercase tracking-widest text-xs">Resumo Executivo</h2>
                <button onClick={() => setShowSummary(false)} className="text-white/50 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 text-white/80 text-sm leading-relaxed">
                {isGeneratingSummary ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-white/20">
                    <Loader2 size={32} className="animate-spin" />
                    <p className="text-xs uppercase tracking-widest font-mono">Processando Inteligência...</p>
                  </div>
                ) : (
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <Markdown>{summary}</Markdown>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                <button 
                  onClick={() => setShowSummary(false)}
                  className="w-full py-4 bg-[#00C853] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest"
                >
                  Fechar Resumo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
