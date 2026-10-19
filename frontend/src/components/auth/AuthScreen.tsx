import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LogIn, Mail, Lock, ShieldCheck, Loader2, ShieldAlert } from 'lucide-react';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'it' | 'pt'>('it');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.toLowerCase().trim();
    const authorizedEmailsEnv = import.meta.env.VITE_AUTHORIZED_EMAILS as string | undefined;
    const AUTHORIZED_EMAILS = authorizedEmailsEnv 
      ? authorizedEmailsEnv.split(',').map(e => e.trim().toLowerCase()) 
      : ['admin@example.com', 'lead.analyst@example.com', 'engineer@example.com'];

    if (!AUTHORIZED_EMAILS.includes(cleanEmail)) {
      setError(
        lang === 'it' 
          ? 'Credenziali non valide o account non autorizzato.' 
          : 'Credenciais inválidas ou conta não autorizada.'
      );
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: any) {
      console.error(err);
      setError(
        lang === 'it' 
          ? 'Credenziali non valide o account non autorizzato.' 
          : 'Credenciais inválidas ou conta não autorizada.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="glass-strong relative w-full max-w-md overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#0A0D0F]/95 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-2xl">
        {/* Emerald Glow Background Effect */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Language Switcher */}
        <div className="absolute right-4 top-4 z-20 flex gap-1 rounded-full bg-black/40 p-1 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setLang('it')}
            className={`rounded-full px-2.5 py-1 transition-all ${lang === 'it' ? 'bg-emerald-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            IT
          </button>
          <button
            type="button"
            onClick={() => setLang('pt')}
            className={`rounded-full px-2.5 py-1 transition-all ${lang === 'pt' ? 'bg-emerald-500 text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            PT
          </button>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center mt-2">
          {/* Logo */}
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-black/80 border border-emerald-500/40 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
            <img src="/logo.png" alt="DataNexus Logo" className="h-14 w-14 object-contain" />
          </div>
          
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {lang === 'it' ? 'Portale Accesso Riservato' : 'Portal de Acesso Restrito'}
          </h1>
          <p className="mt-1 text-xs font-semibold text-emerald-400 font-mono">
            {lang === 'it' 
              ? 'DataNexus Analytics · Gestione Dati'
              : 'DataNexus Analytics · Gestão de Dados'}
          </p>

          {/* Exclusive Use Banner */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left text-xs text-amber-300 shadow-inner">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <div className="font-bold text-white">
                {lang === 'it' ? 'Sistema di Sicurezza Attivo' : 'Sistema de Segurança Ativo'}
              </div>
              <div className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                {lang === 'it'
                  ? 'Accesso ad altissima sicurezza monitorato. La registrazione di nuovi account è disabilitata.'
                  : 'Acesso de alta segurança monitorado. O cadastro de novas contas está desabilitado.'}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 w-full rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-left text-xs font-semibold text-rose-300 shadow-sm animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 w-full space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold uppercase tracking-wider font-mono text-zinc-400">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-400/70" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="utente@dominio.it"
                  className="w-full rounded-xl border border-white/10 bg-black/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[11px] font-semibold uppercase tracking-wider font-mono text-zinc-400">
                {lang === 'it' ? 'Password' : 'Senha'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-emerald-400/70" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/10 bg-black/60 py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  {lang === 'it' ? 'Accedi alla Piattaforma' : 'Entrar na Plataforma'}
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{lang === 'it' ? 'Protezione SSL & Firebase Security Shield' : 'Proteção SSL & Firebase Security Shield'}</span>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            {lang === 'it' ? 'Accesso monitorato e registrato nei log di sistema.' : 'Acesso monitorado e registrado nos logs de sistema.'}
          </div>
        </div>
      </div>
    </div>
  );
}
