import React, { useState } from 'react';
import { User, LogIn, LogOut, Coins, ShieldCheck, X, RefreshCw, KeyRound, Mail } from 'lucide-react';

export interface EmergentUser {
  name: string;
  email: string;
  credits_left: number;
  credits_used: number;
  credits_total: number;
  status: string;
  role?: string;
}

interface EmergentAccountModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: EmergentUser | null;
  onLoginSuccess: (user: EmergentUser, passwordStored: string) => void;
  onLogout: () => void;
  onRefreshCredits: () => Promise<void>;
  isRefreshing?: boolean;
}

export const EmergentAccountModal: React.FC<EmergentAccountModalProps> = ({
  open,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onRefreshCredits,
  isRefreshing = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Preencha seu Gmail e senha cadastrados no app.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/emergent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'E-mail ou senha incorretos.');
      }

      onLoginSuccess(data.user, password);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar sua conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[380px] bg-[#071a12] border border-emerald-800/80 rounded-2xl shadow-2xl text-emerald-50 overflow-hidden font-sans">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-800/60 bg-[#04100b]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wider uppercase text-emerald-400">Conta de Renderização</h3>
              <p className="text-[10px] text-emerald-300/60">Sistema oficial SKP Render Pro</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-900/40 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5">
          {currentUser ? (
            /* USUÁRIO LOGADO */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-300/80 uppercase tracking-wider font-semibold">Cliente Ativo</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Conectado
                  </span>
                </div>
                <div className="text-sm font-semibold text-emerald-100 truncate">{currentUser.name || currentUser.email}</div>
                <div className="text-[11px] text-emerald-300/60 truncate">{currentUser.email}</div>
              </div>

              {/* Card de Créditos */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-900/50 to-emerald-950/80 border border-emerald-700/60 flex items-center justify-between shadow-inner">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/80 uppercase tracking-wide">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    Créditos Disponíveis
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-100 mt-1">
                    {currentUser.credits_left} <span className="text-xs font-normal text-emerald-400">créditos</span>
                  </div>
                  <div className="text-[10px] text-emerald-300/60 mt-0.5">
                    {currentUser.credits_used} já usados
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onRefreshCredits}
                  disabled={isRefreshing}
                  className="p-2 rounded-lg bg-emerald-800/40 hover:bg-emerald-800 text-emerald-300 hover:text-white transition-all cursor-pointer border border-emerald-600/40 active:scale-95 disabled:opacity-50"
                  title="Atualizar saldo de créditos"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Botão Sair */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/40 bg-red-950/20 hover:bg-red-950/50 text-red-300 hover:text-red-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar desta Conta
                </button>
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE LOGIN */
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Entre com o seu <strong>Gmail</strong> e <strong>senha</strong> cadastrados no app para renderizar imagens direto no SketchUp com os seus créditos.
              </p>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs leading-snug">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-emerald-400" />
                    Gmail do Cadastro
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@gmail.com"
                    autoFocus
                    required
                    className="w-full bg-[#04100b] border border-emerald-800 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-emerald-100 placeholder:text-emerald-700/60 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3 text-emerald-400" />
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    required
                    className="w-full bg-[#04100b] border border-emerald-800 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-emerald-100 placeholder:text-emerald-700/60 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#00df82] hover:bg-[#00c975] text-[#071a12] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      Entrar no Plugin
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-emerald-400/60">
                Ainda não tem cadastro? Crie sua conta primeiro no painel web para receber seus créditos.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
