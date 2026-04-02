import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  X, 
  Check, 
  Smartphone, 
  DollarSign, 
  Trophy, 
  MessageCircle, 
  ArrowDown,
  Lock,
  ShieldCheck,
  Zap,
  ChevronRight,
  User as UserIcon,
  LayoutDashboard,
  Calendar,
  Plus,
  Trash2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { BolaoData, UserProfile } from './types';
import { DEFAULT_BOLAO_DATA, STORAGE_KEY } from './constants';
import { auth, db, doc, getDoc, onAuthStateChanged, updateDoc, setDoc, onSnapshot } from './firebase';
import AdminGames from './components/AdminGames';
import AdminUsers from './components/AdminUsers';
import ClientGames from './components/ClientGames';
import UserAuth from './components/UserAuth';
import AuditView from './components/AuditView';
import LoginView from './components/LoginView';

export default function App() {
  const [data, setData] = useState<BolaoData>(DEFAULT_BOLAO_DATA);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('hero');
  const [userActiveTab, setUserActiveTab] = useState<'jogos' | 'auditoria'>('jogos');
  const [toast, setToast] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userHits, setUserHits] = useState(0);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [completeName, setCompleteName] = useState('');
  const [completeBirthDate, setCompleteBirthDate] = useState('');
  const [completePhone, setCompletePhone] = useState('');
  const [completeError, setCompleteError] = useState('');
  const [completeLoading, setCompleteLoading] = useState(false);

  // Check if profile needs completion
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      if (!userProfile.birthDate || !userProfile.phone) {
        setIsCompletingProfile(true);
        setCompleteName(userProfile.displayName || '');
      } else {
        setIsCompletingProfile(false);
      }
    } else {
      setIsCompletingProfile(false);
    }
  }, [userProfile]);

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeName || !completeBirthDate || !completePhone) {
      setCompleteError('Por favor, preencha todos os campos.');
      return;
    }
    setCompleteLoading(true);
    setCompleteError('');
    try {
      if (userProfile) {
        const updatedData = {
          displayName: completeName,
          birthDate: completeBirthDate,
          phone: completePhone,
          status: 'pending' // Reset to pending after completion if it was somehow different
        };
        await updateDoc(doc(db, 'users', userProfile.uid), updatedData);
        setUserProfile({ ...userProfile, ...updatedData });
        setIsCompletingProfile(false);
        setToast('Perfil atualizado! Aguarde a aprovação.');
      }
    } catch (err) {
      setCompleteError('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setCompleteLoading(false);
    }
  };

  // Sync Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let profile: UserProfile;
        
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
        } else {
          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Usuário',
            role: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
            status: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
          };
          await setDoc(doc(db, 'users', user.uid), profile);
        }

        // Force admin role and approved status for the specific email
        if (user.email === 'rrmultimarcasoficiall@gmail.com') {
          if (profile.role !== 'admin' || profile.status !== 'approved') {
            profile.role = 'admin';
            profile.status = 'approved';
            await updateDoc(doc(db, 'users', user.uid), { role: 'admin', status: 'approved' });
          }
        }

        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load data from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        setData(prev => ({ ...prev, ...snapshot.data() }));
      }
    }, (error) => {
      console.error('Error loading config:', error);
    });
    return () => unsub();
  }, []);

  // Initialize config if admin and not exists
  useEffect(() => {
    if (userProfile?.role === 'admin' && !data.pass) {
      const checkAndInit = async () => {
        const snapshot = await getDoc(doc(db, 'config', 'main'));
        if (!snapshot.exists()) {
          await setDoc(doc(db, 'config', 'main'), DEFAULT_BOLAO_DATA);
        }
      };
      checkAndInit();
    }
  }, [userProfile, data.pass]);

  const saveToStorage = async (newData: BolaoData) => {
    try {
      await setDoc(doc(db, 'config', 'main'), newData);
      showToast('Salvo com sucesso!');
    } catch (e) {
      console.error('Error saving config', e);
      showToast('Erro ao salvar');
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleLogin = () => {
    if (loginUser === 'admin' && loginPass === data.pass) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Usuário ou senha incorretos');
      setLoginPass('');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdminOpen(false);
    setLoginUser('');
    setLoginPass('');
  };

  const updateField = (field: keyof BolaoData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-dark-primary text-white-primary selection:bg-green-primary selection:text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,200,83,0.18)_0%,transparent_70%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(21,101,192,0.20)_0%,transparent_70%),radial-gradient(ellipse_50%_50%_at_10%_80%,rgba(255,214,0,0.12)_0%,transparent_70%),#0a0f0d]" />
        
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 60px)' }} />

        <div className="absolute top-8 right-8 z-50">
          <UserAuth userProfile={userProfile} onProfileUpdate={setUserProfile} />
        </div>

        <div className="absolute top-1/4 left-1/4 text-5xl opacity-5 animate-float-ball">⚽</div>
        <div className="absolute top-2/3 right-1/4 text-8xl opacity-5 animate-float-ball [animation-delay:3s]">⚽</div>
        <div className="absolute bottom-1/4 left-1/3 text-6xl opacity-5 animate-float-ball [animation-delay:6s]">⚽</div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 bg-wpp/15 border border-wpp/40 rounded-full px-5 py-2 font-condensed font-bold text-sm tracking-widest text-wpp mb-6">
            <span className="w-2 h-2 rounded-full bg-wpp animate-pulse-custom" />
            {data.badge}
          </div>

          <p className="font-condensed font-black text-lg md:text-xl tracking-[0.25em] text-yellow-primary uppercase mb-2">
            {data.eyebrow}
          </p>

          <h1 className="font-bebas text-7xl md:text-9xl leading-[0.92] mb-6">
            <span className="block">{data.t1}</span>
            <span className="block text-outline">{data.t2}</span>
          </h1>

          <p className="text-lg md:text-xl text-white-primary/70 leading-relaxed mb-10 max-w-xl mx-auto" 
             dangerouslySetInnerHTML={{ __html: data.sub }} />

          <div className="flex flex-wrap justify-center gap-4">
            {userProfile ? (
              <a 
                href="#area-cliente" 
                className="inline-flex items-center gap-3 bg-green-primary text-white font-bold text-lg px-8 py-4 rounded-lg shadow-[0_4px_24px_rgba(0,200,83,0.35)] transition-all hover:-translate-y-1 hover:scale-105 hover:shadow-[0_8px_32px_rgba(0,200,83,0.5)]"
              >
                <LayoutDashboard size={22} />
                Minha Área do Cliente
              </a>
            ) : (
              <a 
                href={data.lh} 
                className="inline-flex items-center gap-3 bg-wpp text-white font-bold text-lg px-8 py-4 rounded-lg shadow-[0_4px_24px_rgba(37,211,102,0.35)] transition-all hover:-translate-y-1 hover:scale-105 hover:shadow-[0_8px_32px_rgba(37,211,102,0.5)]"
              >
                <MessageCircle size={22} fill="currentColor" />
                {data.ctah}
              </a>
            )}
            <a 
              href="#como-funciona" 
              className="inline-flex items-center gap-2 bg-transparent text-white font-bold text-lg px-8 py-4 rounded-lg border-2 border-white/25 transition-all hover:border-yellow-primary hover:text-yellow-primary hover:bg-yellow-primary/5"
            >
              Como funciona <ArrowDown size={20} />
            </a>
          </div>
        </motion.div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-50 text-green-primary animate-bounce">
          <span className="text-xs font-bold tracking-widest">ROLAR</span>
          <ArrowDown size={16} />
        </div>
      </section>

      {/* Stats Bar */}
      <div className="bg-green-dark py-6 px-8 flex flex-wrap justify-center gap-12 md:gap-24 border-y-4 border-yellow-primary">
        {[
          { n: data.s1n, l: data.s1l },
          { n: data.s2n, l: data.s2l },
          { n: data.s3n, l: data.s3l },
          { n: data.s4n, l: data.s4l }
        ].map((s, i) => (
          <div key={i} className="text-center">
            <div className="font-bebas text-4xl text-yellow-primary leading-none">{s.n}</div>
            <div className="text-xs tracking-widest text-white-primary/70 uppercase">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Client Area */}
      <AnimatePresence>
        {userProfile && isCompletingProfile && (
          <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b141a] fixed inset-0 z-[100]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full bg-[#111b21] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-primary/20 rounded-full flex items-center justify-center mx-auto text-green-primary mb-4">
                  <UserIcon size={32} />
                </div>
                <h2 className="font-bebas text-4xl text-white">Complete seu Perfil</h2>
                <p className="text-white-primary/60 text-sm">
                  Para continuar no <strong>BOLÃO FC</strong>, precisamos de algumas informações adicionais.
                </p>
              </div>

              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Nome Completo</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20 group-focus-within:text-green-primary transition-colors">
                      <UserIcon size={18} />
                    </div>
                    <input 
                      type="text" 
                      value={completeName}
                      onChange={(e) => setCompleteName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Data de Nascimento</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20 group-focus-within:text-green-primary transition-colors">
                      <Calendar size={18} />
                    </div>
                    <input 
                      type="date" 
                      value={completeBirthDate}
                      onChange={(e) => setCompleteBirthDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">WhatsApp</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20 group-focus-within:text-green-primary transition-colors">
                      <Smartphone size={18} />
                    </div>
                    <input 
                      type="tel" 
                      value={completePhone}
                      onChange={(e) => setCompletePhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-sm"
                    />
                  </div>
                </div>

                {completeError && (
                  <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{completeError}</p>
                )}

                <button 
                  type="submit"
                  disabled={completeLoading}
                  className="w-full py-4 bg-green-primary hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {completeLoading ? 'Salvando...' : 'Salvar e Continuar'}
                  {!completeLoading && <ArrowRight size={18} />}
                </button>

                <button 
                  type="button"
                  onClick={() => auth.signOut()}
                  className="w-full py-2 text-white-primary/40 hover:text-white-primary/60 text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Sair da Conta
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {userProfile && !isCompletingProfile && userProfile.role === 'user' && userProfile.status === 'pending' && (
          <div className="min-h-screen flex items-center justify-center p-6 bg-[#0b141a]">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full bg-[#111b21] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-yellow-primary/20 rounded-full flex items-center justify-center mx-auto text-yellow-primary">
                <Clock size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="font-bebas text-4xl text-white">Aguardando Aprovação</h2>
                <p className="text-white-primary/60 text-sm leading-relaxed">
                  Olá, <span className="text-white font-bold">{userProfile.displayName}</span>! Sua conta foi criada com sucesso, mas precisa ser aprovada por um administrador para que você possa começar a apostar.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center gap-3 text-xs text-white-primary/40">
                  <div className="w-2 h-2 rounded-full bg-yellow-primary animate-pulse" />
                  Status: <span className="text-yellow-primary font-bold uppercase tracking-widest ml-auto">Pendente</span>
                </div>
                <p className="text-[0.65rem] text-white-primary/30 italic">
                  Você receberá acesso assim que o administrador validar seus dados. Tente entrar novamente mais tarde.
                </p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
              >
                Sair da Conta
              </button>
            </motion.div>
          </div>
        )}

        {userProfile && (userProfile.role === 'admin' || userProfile.status === 'approved') && (
          <motion.section 
            id="area-cliente"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto py-24 px-8 border-t border-white/5"
          >
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-condensed font-bold text-sm tracking-widest text-green-primary uppercase mb-2">Área do Cliente</p>
                <h2 className="font-bebas text-5xl md:text-7xl leading-none">
                  {userActiveTab === 'jogos' ? 'Meus Palpites' : 'Auditoria Pública'}
                </h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  <button 
                    onClick={() => setUserActiveTab('jogos')}
                    className={`px-6 py-2.5 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${userActiveTab === 'jogos' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
                  >
                    <Calendar size={14} /> Jogos
                  </button>
                  {(data.isAuditReady || (data.deadline && new Date() > new Date(data.deadline))) && (
                    <button 
                      onClick={() => setUserActiveTab('auditoria')}
                      className={`px-6 py-2.5 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${userActiveTab === 'auditoria' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
                    >
                      <ShieldCheck size={14} /> Auditoria
                    </button>
                  )}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-primary/20 flex items-center justify-center text-yellow-primary">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <div className="text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">Seu Desempenho</div>
                    <div className="font-bebas text-2xl text-white-primary">{userHits} / 8 Acertos</div>
                  </div>
                </div>
              </div>
            </div>

            {(userActiveTab === 'jogos' || (!data.isAuditReady && !(data.deadline && new Date() > new Date(data.deadline)))) ? (
              <ClientGames userId={userProfile.uid} onHitsUpdate={setUserHits} data={data} />
            ) : (
              <AuditView />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* How it Works */}
      <section id="como-funciona" className="max-w-6xl mx-auto py-24 px-8">
        <div className="mb-16">
          <p className="font-condensed font-bold text-sm tracking-widest text-green-primary uppercase mb-2">Passo a passo</p>
          <h2 className="font-bebas text-5xl md:text-7xl leading-none">Como funciona<br />o bolão?</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { n: '01', i: '📲', t: data.st1t, d: data.st1d },
            { n: '02', i: '💰', t: data.st2t, d: data.st2d },
            { n: '03', i: '⚽', t: data.st3t, d: data.st3d },
            { n: '04', i: '🏆', t: data.st4t, d: data.st4d }
          ].map((step, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -6 }}
              className="group relative bg-white/5 border border-white/10 rounded-2xl p-8 transition-colors hover:border-green-primary overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green-primary to-yellow-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute top-4 right-6 font-bebas text-6xl text-green-primary/15 leading-none">{step.n}</span>
              <div className="text-4xl mb-4">{step.i}</div>
              <h3 className="font-condensed font-black text-xl mb-2">{step.t}</h3>
              <p className="text-white-primary/60 text-sm leading-relaxed">{step.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Prizes Section */}
      <section id="premios" className="bg-gradient-to-br from-green-primary/10 to-blue-600/10 border-y border-white/5 py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <p className="font-condensed font-bold text-sm tracking-widest text-green-primary uppercase mb-2">💸 Prêmios</p>
            <h2 className="font-bebas text-5xl md:text-7xl leading-none mb-6">Quanto você<br />pode ganhar?</h2>
            <p className="text-white-primary/60 max-w-md leading-relaxed">
              {data.psub} <strong className="text-yellow-primary">maior o prêmio!</strong>
            </p>
          </div>

          <div className="flex justify-center">
            {/* Main Prize */}
            <div className="bg-gradient-to-br from-[#b8860b] via-yellow-primary to-[#ffa000] text-black rounded-3xl p-12 md:p-16 text-center relative overflow-hidden shadow-[0_12px_40px_rgba(255,214,0,0.4)] max-w-lg w-full transform transition-transform hover:scale-105">
              <span className="absolute top-2 right-6 font-bebas text-9xl opacity-10">🏆</span>
              <div className="text-6xl mb-4">🥇</div>
              <h3 className="font-condensed font-black text-2xl tracking-widest uppercase opacity-80 mb-4">Prêmio Acumulado</h3>
              <div className="font-bebas text-7xl md:text-8xl leading-none">{data.p1v}</div>
              <div className="text-lg font-bold opacity-70 mt-2">{data.p1d}</div>
              <div className="mt-8 pt-8 border-t border-black/10 text-sm font-medium leading-relaxed">
                O prêmio será dividido igualmente entre todos os ganhadores que acertarem o maior número de jogos.
              </div>
            </div>
          </div>

          <p className="text-center mt-12 text-sm text-white-primary/40 italic">
            {data.pnote}
          </p>
        </div>
      </section>

      {/* Rules Section */}
      <section id="regras" className="max-w-6xl mx-auto py-24 px-8">
        <div className="mb-16">
          <p className="font-condensed font-bold text-sm tracking-widest text-green-primary uppercase mb-2">📋 Regras</p>
          <h2 className="font-bebas text-5xl md:text-7xl leading-none">Simples de jogar,<br />fácil de ganhar</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <ul className="space-y-4">
            {data.rules.map((rule, i) => (
              <li key={i} className="flex gap-4 items-start py-4 border-b border-white/5 text-lg text-white-primary/80 leading-relaxed">
                <Check className="text-green-primary shrink-0 mt-1" size={20} />
                <span dangerouslySetInnerHTML={{ __html: rule }} />
              </li>
            ))}
          </ul>

          <div className="flex justify-center">
            <div className="bg-[#111] rounded-[32px] p-4 border-[6px] border-[#222] shadow-[0_24px_64px_rgba(0,0,0,0.5)] max-w-[280px] w-full">
              <div className="bg-[#e5ddd5] rounded-[22px] overflow-hidden min-h-[420px] flex flex-col">
                <div className="bg-wpp-dark p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-primary flex items-center justify-center text-lg">⚽</div>
                  <div>
                    <div className="text-white text-[0.85rem] font-bold leading-tight">{data.wn}</div>
                    <div className="text-white/70 text-[0.7rem]">{data.ws}</div>
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="max-w-[85%] bg-white p-2 rounded-lg rounded-tl-none text-[0.78rem] leading-tight self-start shadow-sm text-[#111b21]">
                    📢 <strong>Jogo 1:</strong> Brasil 🇧🇷 x Argentina 🇦🇷<br />Qual o seu palpite?
                    <div className="text-[0.6rem] text-gray-500 text-right mt-1">09:00</div>
                  </div>
                  <div className="max-w-[85%] bg-[#d9fdd3] p-2 rounded-lg rounded-tr-none text-[0.78rem] leading-tight self-end shadow-sm text-[#111b21]">
                    Meu palpite: <strong>Vitória</strong> Brasil 🇧🇷⚽
                    <div className="text-[0.6rem] text-gray-500 text-right mt-1">09:14</div>
                  </div>
                  <div className="max-w-[85%] bg-white p-2 rounded-lg rounded-tl-none text-[0.78rem] leading-tight self-start shadow-sm text-[#111b21]">
                    ✅ Palpite registrado!<br />Boa sorte! 🍀
                    <div className="text-[0.6rem] text-gray-500 text-right mt-1">09:14</div>
                  </div>
                  <div className="max-w-[85%] bg-white p-2 rounded-lg rounded-tl-none text-[0.78rem] leading-tight self-start shadow-sm text-[#111b21]">
                    🎉 FIM DE JOGO!<br />Brasil 2x1 Argentina<br /><strong>Você acertou o vencedor! ✅</strong>
                    <div className="text-[0.6rem] text-gray-500 text-right mt-1">23:01</div>
                  </div>
                  <div className="max-w-[85%] bg-[#d9fdd3] p-2 rounded-lg rounded-tr-none text-[0.78rem] leading-tight self-end shadow-sm text-[#111b21]">
                    <span className="text-2xl">🤩🏆</span>
                    <div className="text-[0.6rem] text-gray-500 text-right mt-1">23:02</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="entrar" className="relative py-24 px-8 text-center border-t border-green-primary/15 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(0,200,83,0.12)_0%,transparent_70%)]">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
          <div>
            <p className="font-condensed font-bold text-sm tracking-widest text-green-primary uppercase mb-2">⚡ Vagas limitadas</p>
            <h2 className="font-bebas text-5xl md:text-7xl leading-none mb-4">Pronto pra ser<br />campeão?</h2>
            <p className="text-white-primary/60 max-w-md mx-auto leading-relaxed">
              {data.csub}
            </p>
          </div>

          <a 
            href={data.lf}
            className="inline-flex items-center gap-3 bg-wpp text-white font-bold text-xl px-10 py-5 rounded-lg shadow-[0_4px_24px_rgba(37,211,102,0.35)] transition-all hover:-translate-y-1 hover:scale-105 hover:shadow-[0_8px_32px_rgba(37,211,102,0.5)]"
          >
            <MessageCircle size={24} fill="currentColor" />
            {data.ctaf}
          </a>

          <div className="flex flex-wrap justify-center gap-8 mt-4">
            <div className="flex items-center gap-2 text-sm text-white-primary/50">
              <Lock size={16} className="text-green-primary" />
              {data.tr1}
            </div>
            <div className="flex items-center gap-2 text-sm text-white-primary/50">
              <ShieldCheck size={16} className="text-green-primary" />
              {data.tr2}
            </div>
            <div className="flex items-center gap-2 text-sm text-white-primary/50">
              <Smartphone size={16} className="text-green-primary" />
              {data.tr3}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center">
        <p className="text-sm text-white-primary/30">{data.foot}</p>
        {userProfile?.role === 'admin' && (
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="mt-4 text-white-primary/5 hover:text-white-primary/20 transition-colors cursor-pointer"
          >
            <Settings size={16} />
          </button>
        )}
      </footer>

      {/* Admin Overlay */}
      <AnimatePresence>
        {isAdminOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
          >
            {!isLoggedIn ? (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#111418] border border-white/10 rounded-3xl p-10 w-full max-w-sm text-center"
              >
                <div className="w-16 h-16 bg-green-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Settings className="text-green-primary" size={32} />
                </div>
                <h2 className="font-bebas text-3xl mb-2">Painel Admin</h2>
                <p className="text-white-primary/40 text-sm mb-8">Acesso restrito ao administrador</p>
                
                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase mb-1">Usuário</label>
                    <input 
                      type="text" 
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      placeholder="admin"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase mb-1">Senha</label>
                    <input 
                      type="password" 
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-primary transition-colors"
                    />
                  </div>
                </div>

                {loginError && <p className="text-red-400 text-xs mt-4">{loginError}</p>}

                <button 
                  onClick={handleLogin}
                  className="w-full bg-green-primary text-white font-bold py-3 rounded-lg mt-8 hover:bg-green-dark transition-colors"
                >
                  Entrar
                </button>
                <button 
                  onClick={() => setIsAdminOpen(false)}
                  className="w-full text-white-primary/40 text-xs mt-4 hover:text-white-primary/60"
                >
                  Cancelar
                </button>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-[#111418] border border-white/10 rounded-3xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh]"
              >
                <div className="bg-gradient-to-r from-[#0f2027] to-[#1e3a4a] p-6 flex items-center justify-between shrink-0">
                  <h2 className="font-bebas text-2xl tracking-wider">⚙ Painel Admin — BOLÃO FC</h2>
                  <div className="flex items-center gap-4">
                    <button onClick={handleLogout} className="text-white-primary/40 hover:text-white-primary/80 text-xs font-bold uppercase tracking-widest">Sair</button>
                    <button onClick={() => setIsAdminOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500/50 transition-colors"><X size={18} /></button>
                  </div>
                </div>

                <div className="flex bg-[#0d1114] border-b border-white/5 overflow-x-auto shrink-0">
                  {['hero', 'login', 'links', 'stats', 'passos', 'premios', 'regras', 'jogos', 'usuarios', 'config'].map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? 'text-green-primary border-green-primary' : 'text-white-primary/40 border-transparent hover:text-white-primary/70'}`}
                    >
                      {tab === 'hero' && '🏠 Hero'}
                      {tab === 'login' && '🔑 Login'}
                      {tab === 'links' && '🔗 Links WPP'}
                      {tab === 'stats' && '📊 Stats'}
                      {tab === 'passos' && '📋 Passos'}
                      {tab === 'premios' && '🏆 Prêmios'}
                      {tab === 'regras' && '📜 Regras'}
                      {tab === 'jogos' && '⚽ Jogos'}
                      {tab === 'usuarios' && '👥 Usuários'}
                      {tab === 'config' && '⚙ Config'}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  {activeTab === 'jogos' && (
                    <AdminGames />
                  )}
                  {activeTab === 'usuarios' && (
                    <AdminUsers />
                  )}
                  {activeTab === 'login' && (
                    <div className="space-y-6">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Personalização da Página de Login</h3>
                      <AdminField label="URL ou Upload da Imagem de Fundo" value={data.loginImg} onChange={(v) => updateField('loginImg', v)} isImage />
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white-primary/40 leading-relaxed space-y-2">
                        <p>💡 <strong>Dica:</strong> Use links de imagens diretos ou carregue do seu computador.</p>
                        <p>📏 <strong>Tamanhos recomendados:</strong></p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li><strong>PC:</strong> 1920x1080 pixels (16:9)</li>
                          <li><strong>Celular:</strong> 1080x1920 pixels (9:16)</li>
                        </ul>
                      </div>
                      <AdminField label="Badge (texto pequeno no topo)" value={data.loginBadge} onChange={(v) => updateField('loginBadge', v)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Título Parte 1" value={data.loginTitle1} onChange={(v) => updateField('loginTitle1', v)} />
                        <AdminField label="Título Parte 2 (Verde)" value={data.loginTitle2} onChange={(v) => updateField('loginTitle2', v)} />
                      </div>
                      <AdminField label="Subtítulo da Login" value={data.loginSub} onChange={(v) => updateField('loginSub', v)} isTextArea />
                    </div>
                  )}
                  {activeTab === 'hero' && (
                    <div className="space-y-6">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Seção Principal (Hero)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Título Linha 1" value={data.t1} onChange={(v) => updateField('t1', v)} />
                        <AdminField label="Título Linha 2" value={data.t2} onChange={(v) => updateField('t2', v)} />
                      </div>
                      <AdminField label="Badge (topo)" value={data.badge} onChange={(v) => updateField('badge', v)} />
                      <AdminField label="Eyebrow (acima do título)" value={data.eyebrow} onChange={(v) => updateField('eyebrow', v)} />
                      <AdminField label="Subtítulo principal" value={data.sub} onChange={(v) => updateField('sub', v)} isTextArea />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Texto botão Hero" value={data.ctah} onChange={(v) => updateField('ctah', v)} />
                        <AdminField label="Texto botão CTA Final" value={data.ctaf} onChange={(v) => updateField('ctaf', v)} />
                      </div>
                      <AdminField label="Subtítulo CTA Final" value={data.csub} onChange={(v) => updateField('csub', v)} isTextArea />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Confiança 1" value={data.tr1} onChange={(v) => updateField('tr1', v)} />
                        <AdminField label="Confiança 2" value={data.tr2} onChange={(v) => updateField('tr2', v)} />
                      </div>
                      <AdminField label="Confiança 3" value={data.tr3} onChange={(v) => updateField('tr3', v)} />
                      <AdminField label="Texto do Rodapé" value={data.foot} onChange={(v) => updateField('foot', v)} />
                    </div>
                  )}

                  {activeTab === 'links' && (
                    <div className="space-y-6">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Links do WhatsApp</h3>
                      <div className="bg-wpp/5 border border-wpp/20 rounded-xl p-5 text-sm text-white-primary/60 leading-relaxed mb-6">
                        💡 <strong>Como gerar seu link do WhatsApp:</strong><br />
                        Use o formato: <code className="text-green-primary">https://wa.me/55DDD9XXXXXXXX</code><br />
                        Ou cole o link de convite da sua Comunidade do WhatsApp diretamente aqui.
                      </div>
                      <AdminField label="🔗 Link botão Hero" value={data.lh} onChange={(v) => updateField('lh', v)} />
                      <AdminField label="🔗 Link botão CTA Final" value={data.lf} onChange={(v) => updateField('lf', v)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Nome do grupo (mockup celular)" value={data.wn} onChange={(v) => updateField('wn', v)} />
                        <AdminField label="Info do grupo" value={data.ws} onChange={(v) => updateField('ws', v)} />
                      </div>
                    </div>
                  )}

                  {activeTab === 'stats' && (
                    <div className="space-y-6">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Barra de Estatísticas</h3>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <AdminField label={`Número ${i}`} value={data[`s${i}n` as keyof BolaoData] as string} onChange={(v) => updateField(`s${i}n` as keyof BolaoData, v)} />
                          <AdminField label={`Label ${i}`} value={data[`s${i}l` as keyof BolaoData] as string} onChange={(v) => updateField(`s${i}l` as keyof BolaoData, v)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'passos' && (
                    <div className="space-y-8">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Como Funciona — 4 Passos</h3>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-4">
                          <p className="text-[0.65rem] font-bold tracking-widest text-green-primary uppercase">Passo {i}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AdminField label="Título" value={data[`st${i}t` as keyof BolaoData] as string} onChange={(v) => updateField(`st${i}t` as keyof BolaoData, v)} />
                            <AdminField label="Descrição" value={data[`st${i}d` as keyof BolaoData] as string} onChange={(v) => updateField(`st${i}d` as keyof BolaoData, v)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'premios' && (
                    <div className="space-y-6">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Seção de Prêmios</h3>
                      <AdminField label="Subtítulo da seção" value={data.psub} onChange={(v) => updateField('psub', v)} isTextArea />
                      <AdminField label="Nota de rodapé dos prêmios" value={data.pnote} onChange={(v) => updateField('pnote', v)} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AdminField label="Valor do Prêmio Principal" value={data.p1v} onChange={(v) => updateField('p1v', v)} />
                        <AdminField label="Descrição do Prêmio" value={data.p1d} onChange={(v) => updateField('p1d', v)} />
                      </div>
                      <div className="bg-yellow-primary/5 border border-yellow-primary/20 rounded-xl p-4 text-xs text-yellow-primary/80 leading-relaxed">
                        💡 <strong>Nota:</strong> O sistema agora utiliza um prêmio único que é dividido entre os ganhadores com maior número de acertos.
                      </div>
                    </div>
                  )}

                  {activeTab === 'regras' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-6">
                        <h3 className="font-bebas text-xl text-white-primary/60">Regras do Bolão</h3>
                        <button 
                          onClick={() => {
                            const newRules = [...data.rules, ''];
                            setData(prev => ({ ...prev, rules: newRules }));
                          }}
                          className="bg-green-primary/10 hover:bg-green-primary/20 text-green-primary text-[0.65rem] font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                        >
                          <Plus size={14} /> Adicionar Regra
                        </button>
                      </div>
                      <div className="space-y-4">
                        {data.rules.map((rule, i) => (
                          <div key={i} className="flex items-end gap-4 bg-white/2 p-4 rounded-xl border border-white/5">
                            <div className="flex-1">
                              <AdminField 
                                label={`Regra ${i + 1}`} 
                                value={rule} 
                                onChange={(v) => {
                                  const newRules = [...data.rules];
                                  newRules[i] = v;
                                  setData(prev => ({ ...prev, rules: newRules }));
                                }} 
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newRules = data.rules.filter((_, idx) => idx !== i);
                                setData(prev => ({ ...prev, rules: newRules }));
                              }}
                              className="p-3 text-white-primary/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                              title="Remover regra"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'config' && (
                    <div className="space-y-8">
                      <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Segurança — Alterar Senha</h3>
                      <div className="bg-yellow-primary/5 border border-yellow-primary/20 rounded-2xl p-8">
                        <h4 className="text-yellow-primary text-[0.7rem] font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
                          <ShieldCheck size={14} /> Auditoria e Transparência
                        </h4>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-white-primary/80">Liberar Auditoria Pública</p>
                            <p className="text-xs text-white-primary/40">Ao ativar, todos os usuários logados poderão ver a lista completa de apostas.</p>
                          </div>
                          <button 
                            onClick={() => updateField('isAuditReady', !data.isAuditReady)}
                            className={`w-14 h-8 rounded-full p-1 transition-colors ${data.isAuditReady ? 'bg-green-primary' : 'bg-white/10'}`}
                          >
                            <div className={`w-6 h-6 bg-white rounded-full transition-transform ${data.isAuditReady ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/5">
                          <AdminField 
                            label="Data/Hora Limite das Apostas" 
                            type="datetime-local"
                            value={data.deadline} 
                            onChange={(v) => updateField('deadline', v)} 
                          />
                          <p className="text-[0.6rem] text-white-primary/30 mt-2">
                            As apostas serão bloqueadas automaticamente após este horário.
                          </p>
                        </div>
                      </div>

                      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
                        <h4 className="text-red-400 text-[0.7rem] font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
                          <Lock size={14} /> Nova senha de acesso
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <AdminField label="Nova senha" value={loginPass} onChange={setLoginPass} type="password" />
                          <AdminField label="Confirmar nova senha" value="" onChange={() => {}} type="password" />
                        </div>
                        <button 
                          onClick={() => {
                            if (loginPass.length >= 4) {
                              saveToStorage({ ...data, pass: loginPass });
                              showToast('Senha alterada!');
                            } else {
                              showToast('Senha muito curta!');
                            }
                          }}
                          className="bg-orange-600 text-white font-bold px-8 py-3 rounded-lg mt-6 hover:bg-orange-700 transition-colors"
                        >
                          Alterar Senha
                        </button>
                      </div>
                      
                      <div className="text-sm text-white-primary/30 space-y-2">
                        <p>✅ Todas as alterações são salvas automaticamente no navegador.</p>
                        <p>✅ O ícone ⚙ no rodapé é o link de acesso ao admin — discreto para visitantes.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#0d1114] p-6 border-t border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => saveToStorage(data)}
                      className="bg-green-primary text-white font-bold px-10 py-3 rounded-lg hover:bg-green-dark transition-all flex items-center gap-2"
                    >
                      <Check size={18} /> Salvar Alterações
                    </button>
                    <AnimatePresence>
                      {toast && (
                        <motion.span 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="text-green-primary text-sm font-bold flex items-center gap-1"
                        >
                          <Check size={16} /> {toast}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login View Overlay */}
      <AnimatePresence>
        {!userProfile && isAuthReady && (
          <LoginView 
            data={data}
            onLoginSuccess={(profile) => setUserProfile(profile)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminField({ label, value, onChange, isTextArea, type = 'text', isImage }: { label: string, value: string, onChange: (v: string) => void, isTextArea?: boolean, type?: string, isImage?: boolean }) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // ~800KB limit to stay safe with Firestore 1MB limit
        alert('A imagem é muito grande! Tente uma imagem menor que 800KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        onChange(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-1">
      <label className="block text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">{label}</label>
      {isTextArea ? (
        <textarea 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-primary transition-colors min-h-[100px] text-sm"
        />
      ) : isImage ? (
        <div className="space-y-2">
          <input 
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-primary transition-colors text-sm"
            placeholder="URL da imagem..."
          />
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-[0.65rem] font-bold uppercase tracking-widest py-2 px-4 rounded-lg transition-all flex items-center gap-2">
              <Smartphone size={14} /> Carregar do PC
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            {value && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                <img src={value} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-primary transition-colors text-sm"
        />
      )}
    </div>
  );
}
