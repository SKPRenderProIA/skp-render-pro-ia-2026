import React, { useState, useEffect } from 'react';
import { KeyRound, Copy, Check, RefreshCw, ShieldAlert, Sparkles, HelpCircle, MessageSquare, Download } from 'lucide-react';

interface SketchUpActivationLockProps {
  pcId: string;
  errorMessage?: string;
  onActivated: (clientName?: string) => void;
  onRecheck: () => Promise<void>;
  onDownloadRb?: () => void;
}

export const SketchUpActivationLock: React.FC<SketchUpActivationLockProps> = ({
  pcId,
  errorMessage,
  onActivated,
  onRecheck,
  onDownloadRb,
}) => {
  const [copied, setCopied] = useState(false);
  const [whatsappClicked, setWhatsappClicked] = useState(false);
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-verificação contínua em tempo real (Polling inteligente a cada 3 segundos):
  // Assim que o administrador ativa o PC ID no painel, o SketchUp do cliente desbloqueia sozinho!
  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      if (!pcId) return;
      try {
        const res = await fetch(`/api/license/check-status?pcId=${encodeURIComponent(pcId)}&t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.active === true && active) {
          setSuccessMsg(`✓ Computador ativado com sucesso pelo administrador! Entrando no SKP Render Pro IA...`);
          if (data.licenseKey && (window as any).sketchup?.atualizar_chave_ativada) {
            try {
              (window as any).sketchup.atualizar_chave_ativada(data.licenseKey);
            } catch (_) {}
          }
          setTimeout(() => {
            if (active) {
              onActivated(data.clientName);
            }
          }, 1200);
        }
      } catch (_) {}
    };

    // Verificação inicial imediata
    checkStatus();

    // Loop a cada 3 segundos enquanto a tela de bloqueio estiver aberta
    const timer = setInterval(checkStatus, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pcId, onActivated]);

  const handleCopyPcId = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pcId);
      } else {
        const ta = document.createElement('textarea');
        ta.value = pcId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenWhatsApp = () => {
    handleCopyPcId();
    setWhatsappClicked(true);
    setTimeout(() => setWhatsappClicked(false), 4000);

    const msg = `Olá! Gostaria de ativar minha licença do SKP RENDER PRO IA.\n\nMeu ID (PC ID) é:\n${pcId}`;
    // Link com mensagem pré-formatada direta para o WhatsApp de suporte:
    const whatsappUrl = `https://wa.me/5581985881608?text=${encodeURIComponent(msg)}`;

    // Se estiver no SketchUp, chama a ação nativa para abrir no navegador padrão do Windows:
    if ((window as any).sketchup?.abrir_url_externa) {
      try {
        (window as any).sketchup.abrir_url_externa(whatsappUrl);
        return;
      } catch (_) {}
    }

    try {
      window.open(whatsappUrl, '_blank');
    } catch (_) {
      window.location.href = whatsappUrl;
    }
  };

  const handleOpenInstagram = () => {
    const instagramUrl = 'https://www.instagram.com/skp.renderpro?igsh=MzR2cG13bG8xNDU0';

    if ((window as any).sketchup?.abrir_url_externa) {
      try {
        (window as any).sketchup.abrir_url_externa(instagramUrl);
        return;
      } catch (_) {}
    }

    try {
      window.open(instagramUrl, '_blank');
    } catch (_) {
      window.location.href = instagramUrl;
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = activationKey.trim();
    if (!key) {
      setLocalError('Por favor, cole sua chave de ativação.');
      return;
    }

    setIsActivating(true);
    setLocalError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, pcId }),
      });
      const data = await res.json();

      if (data.valid) {
        setSuccessMsg(`✓ Licença ativada com sucesso! Bem-vindo(a), ${data.clientName || 'Usuário'}.`);
        // Notifica o SketchUp para persistir a chave no registro da máquina
        if ((window as any).sketchup?.atualizar_chave_ativada) {
          try {
            (window as any).sketchup.atualizar_chave_ativada(key);
          } catch (_) {}
        }
        setTimeout(() => {
          onActivated(data.clientName);
        }, 1200);
      } else {
        setLocalError(data.message || 'Chave de ativação inválida ou recusada.');
      }
    } catch (err: any) {
      setLocalError('Erro ao comunicar com o servidor de validação.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleCheckOnline = async () => {
    setIsRechecking(true);
    setLocalError(null);
    try {
      await onRecheck();
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500/30">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Barra superior de ações rápidas: Download do Plugin .RB */}
        <div className="flex items-center justify-start pb-3 border-b border-neutral-800/80">
          <button
            type="button"
            onClick={onDownloadRb}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/70 hover:bg-emerald-900/90 active:scale-95 border border-emerald-500/40 rounded-lg shadow-xs transition-all cursor-pointer"
            title="Baixar Plugin Ruby (.rb) para SketchUp"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Baixar .RB</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-1 rounded-2xl bg-black/40 border border-emerald-500/30 shadow-lg mb-1 overflow-hidden">
            <img 
              src="/skp_logo_clean.png" 
              alt="SKP RENDER PRO IA" 
              className="w-14 h-14 object-contain rounded-xl"
              onError={(e) => {
                // Fallback gracioso para outro asset caso necessário
                (e.currentTarget as HTMLImageElement).src = '/logo_cropped.png';
              }}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>SKP RENDER PRO IA</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Ativação
            </span>
          </h1>
          <p className="text-xs text-neutral-400">
            {errorMessage || 'Este computador precisa de uma licença ativa para utilizar o plugin.'}
          </p>
        </div>

        {/* Card UUID / PC ID */}
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
            <span>ID do seu Computador (PC ID)</span>
            <span className="text-[10px] text-amber-400/80">Identificador Único</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={pcId}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-200 select-all focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={handleCopyPcId}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                copied
                  ? 'bg-emerald-500 text-neutral-950 font-semibold shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
              title="Copiar ID"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Envie este ID para o administrador para cadastrar sua licença.
          </p>
        </div>

        {/* Botão de Solicitação Direta via WhatsApp */}
        <button
          type="button"
          onClick={handleOpenWhatsApp}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold text-xs flex items-center justify-between shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all group active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="font-bold text-white text-xs">Chamar no WhatsApp</div>
              <div className="text-[10px] text-emerald-100 font-normal">
                {whatsappClicked ? 'Abrindo WhatsApp e copiando seu ID...' : 'Clique para enviar seu PC ID e liberar licença'}
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-black/20 text-white font-medium border border-white/10 group-hover:bg-black/30 transition-all">
            Enviar ID &rarr;
          </span>
        </button>

        {/* Botão de Instagram */}
        <button
          type="button"
          onClick={handleOpenInstagram}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-900/40 via-pink-900/40 to-amber-900/30 hover:from-purple-800/60 hover:via-pink-800/60 hover:to-amber-800/50 text-white font-medium text-xs flex items-center justify-between shadow-md border border-pink-500/30 transition-all group active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shrink-0 shadow-sm">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                <span>Seguir no Instagram</span>
                <span className="text-[10px] font-normal text-pink-300">@skp.renderpro</span>
              </div>
              <div className="text-[10px] text-neutral-300 font-normal">
                Novidades, tutoriais e renders da comunidade
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-200 font-medium border border-pink-400/20 group-hover:bg-pink-500/30 transition-all">
            Abrir &rarr;
          </span>
        </button>

        {/* Formulário de Chave de Ativação */}
        <form onSubmit={handleActivate} className="space-y-3">
          <label className="block text-xs font-medium text-neutral-300">
            Já possui uma Chave de Licença?
          </label>
          <div className="relative">
            <textarea
              rows={2}
              value={activationKey}
              onChange={(e) => {
                setActivationKey(e.target.value);
                if (localError) setLocalError(null);
              }}
              placeholder="Cole sua chave aqui..."
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all resize-none"
            />
          </div>

          {localError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isActivating || !activationKey.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isActivating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Validando chave...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Ativar Licença Agora</span>
              </>
            )}
          </button>
        </form>

        {/* Botão de Verificação Automática Online */}
        <div className="pt-2 border-t border-neutral-800/80 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleCheckOnline}
            disabled={isRechecking}
            className="text-xs text-neutral-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRechecking ? 'animate-spin' : ''}`} />
            <span>O administrador já liberou? Sincronizar agora</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-neutral-400 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>SKP RENDER PRO IA &bull; Sistema Oficial de Proteção</span>
        </div>
      </div>
    </div>
  );
};
