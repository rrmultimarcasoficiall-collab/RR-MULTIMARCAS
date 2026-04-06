import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
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
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import AdminGames from './components/AdminGames';
import AdminUsers from './components/AdminUsers';
import AdminPayments from './components/AdminPayments';
import AdminTeams from './components/AdminTeams';
import ClientGames from './components/ClientGames';
import UserAuth from './components/UserAuth';
import AuditView from './components/AuditView';
import LoginView from './components/LoginView';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes('permissions')) {
          errorMessage = "Erro de permissão no banco de dados. Tente atualizar a página ou contate o administrador.";
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-dark-primary flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
              <X size={40} />
            </div>
            <h2 className="font-bebas text-4xl text-white">Ops! Algo deu errado</h2>
            <p className="text-white-primary/60 text-sm leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-green-primary hover:bg-green-600 text-black font-bold rounded-2xl transition-all shadow-lg"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<BolaoData>(DEFAULT_BOLAO_DATA);
  const [activeTab, setActiveTab] = useState('jogos');
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
  const [isAdminVisible, setIsAdminVisible] = useState(true);

  // Scroll to top on mount and tab change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [userActiveTab]);

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
    let unsubUser: (() => void) | null = null;
    
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Initial check and creation
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
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
          await setDoc(userDocRef, profile);
        }

        // Force admin role and approved status for the specific email
        if (user.email === 'rrmultimarcasoficiall@gmail.com') {
          if (profile.role !== 'admin' || profile.status !== 'approved') {
            await updateDoc(userDocRef, { role: 'admin', status: 'approved' });
          }
        }

        // Real-time listener for user profile
        unsubUser = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
      } else {
        setUserProfile(null);
        if (unsubUser) unsubUser();
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Load data from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        setData(prev => ({ ...prev, ...snapshot.data() }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
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

  const updateField = (field: keyof BolaoData, value: any) => {
    let newData = { ...data, [field]: value };
    
    // Automatically sync deadline if nextRoundDate or nextRoundTime changes
    if (field === 'nextRoundDate' || field === 'nextRoundTime') {
      const date = field === 'nextRoundDate' ? value : data.nextRoundDate;
      const time = field === 'nextRoundTime' ? value : data.nextRoundTime;
      if (date && time) {
        newData.deadline = `${date}T${time}`;
      }
    }

    setData(newData);
    // Auto-save critical fields immediately
    if (['isBettingClosed', 'isAuditReady', 'deadline', 'isOverrideClosed', 'nextRoundTitle', 'nextRoundDate', 'nextRoundTime'].includes(field)) {
      saveToStorage(newData);
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-dark-primary text-white-primary selection:bg-green-primary selection:text-white">
      <div className="fixed top-8 right-8 z-50 flex items-center gap-4">
        {userProfile?.role === 'admin' && (
          <button 
            onClick={() => setIsAdminVisible(!isAdminVisible)}
            className={`bg-zinc-900/80 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl ${isAdminVisible ? 'text-green-primary border-green-primary/50' : 'text-white-primary/70 hover:text-green-primary'}`}
          >
            <Settings size={16} />
            <span className="hidden md:inline">{isAdminVisible ? 'Ocultar Configurações' : 'Mostrar Configurações'}</span>
          </button>
        )}
        <UserAuth userProfile={userProfile} onProfileUpdate={setUserProfile} />
      </div>

      {/* Client Area */}
      <AnimatePresence>
        {userProfile && isCompletingProfile && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-[#0b141a] overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full bg-[#111b21] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl my-auto"
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
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-[#0b141a] overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full bg-[#111b21] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl my-auto"
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
            className="max-w-6xl mx-auto py-12 md:py-24 px-4 md:px-8 border-t border-white/5"
          >
            <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="font-condensed font-bold text-xs md:text-sm tracking-widest text-green-primary uppercase mb-2">Área do Cliente</p>
                <h2 className="font-bebas text-4xl md:text-7xl leading-none">
                  {userActiveTab === 'jogos' ? 'Meus Palpites' : 'Auditoria Pública'}
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full sm:w-auto">
                  <button 
                    onClick={() => setUserActiveTab('jogos')}
                    className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 rounded-lg text-[0.6rem] md:text-[0.65rem] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${userActiveTab === 'jogos' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
                  >
                    <Calendar size={14} /> Jogos
                  </button>
                  {(data.isAuditReady || (data.deadline && new Date() > new Date(data.deadline.includes('T') ? data.deadline + ":00Z" : data.deadline))) && (
                    <button 
                      onClick={() => setUserActiveTab('auditoria')}
                      className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 rounded-lg text-[0.6rem] md:text-[0.65rem] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${userActiveTab === 'auditoria' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
                    >
                      <ShieldCheck size={14} /> Auditoria
                    </button>
                  )}
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 w-full sm:w-auto justify-center sm:justify-start">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-yellow-primary/20 flex items-center justify-center text-yellow-primary shrink-0">
                    <Trophy size={18} md:size={20} />
                  </div>
                  <div>
                    <div className="text-[0.55rem] md:text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">Seu Desempenho</div>
                    <div className="font-bebas text-xl md:text-2xl text-white-primary">{userHits} / 8 Acertos</div>
                  </div>
                </div>
              </div>
            </div>

            {(userActiveTab === 'jogos' || (!data.isAuditReady && !(data.deadline && new Date() > new Date(data.deadline.includes('T') ? data.deadline + ":00Z" : data.deadline)))) ? (
              <ClientGames userId={userProfile.uid} userProfile={userProfile} onHitsUpdate={setUserHits} data={data} />
            ) : (
              <AuditView currentUser={userProfile} />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center">
        <p className="text-sm text-white-primary/30">{data.foot}</p>
      </footer>

      {/* Admin Panel Integrated into Main Page */}
      <AnimatePresence>
        {userProfile?.role === 'admin' && isAdminVisible && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-20 bg-[#0a0f0d] border-y border-white/5 overflow-hidden mt-20"
          >
            <div className="max-w-7xl mx-auto px-4 py-12">
              <div className="bg-[#111418] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                <div className="bg-gradient-to-r from-[#0f2027] to-[#1e3a4a] p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-primary/20 flex items-center justify-center text-green-primary shrink-0">
                      <Settings size={20} />
                    </div>
                    <h2 className="font-bebas text-xl md:text-2xl tracking-wider uppercase">Painel de Controle Administrativo</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                      <div className="w-2 h-2 rounded-full bg-green-primary animate-pulse" />
                      <span className="text-[0.6rem] font-bold text-white-primary/60 uppercase tracking-widest">Modo Admin Ativo</span>
                    </div>
                  </div>
                </div>

                <div className="flex bg-[#0d1114] border-b border-white/5 overflow-x-auto shrink-0 scrollbar-hide">
                  {['login', 'links', 'jogos', 'escudos', 'usuarios', 'pagamentos', 'config'].map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? 'text-green-primary border-green-primary' : 'text-white-primary/40 border-transparent hover:text-white-primary/70'}`}
                    >
                      {tab === 'login' && '🔑 Login'}
                      {tab === 'links' && '🔗 Links WPP'}
                      {tab === 'jogos' && '⚽ Jogos'}
                      {tab === 'escudos' && '🛡 Escudos'}
                      {tab === 'usuarios' && '👥 Usuários'}
                      {tab === 'pagamentos' && '💰 Pagamentos'}
                      {tab === 'config' && '⚙ Config'}
                    </button>
                  ))}
                </div>

                <div className="p-8 min-h-[600px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === 'jogos' && (
                        <AdminGames />
                      )}
                      {activeTab === 'escudos' && (
                        <AdminTeams />
                      )}
                      {activeTab === 'usuarios' && (
                        <AdminUsers />
                      )}
                      {activeTab === 'pagamentos' && (
                        <AdminPayments />
                      )}
                      {activeTab === 'links' && (
                        <div className="space-y-6">
                          <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Configuração de Links e Pagamentos</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AdminField label="Chave Pix (E-mail, CPF ou Aleatória)" value={data.pixKey || ''} onChange={(v) => updateField('pixKey', v)} />
                            <AdminField label="Valor por Cartela (R$)" value={String(data.pricePerTicket || 10)} onChange={(v) => updateField('pricePerTicket', Number(v))} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AdminField label="WhatsApp de Suporte (Ex: 5561999999999)" value={data.wn || ''} onChange={(v) => updateField('wn', v)} />
                            <AdminField label="Link do Grupo/Comunidade" value={data.lh || ''} onChange={(v) => updateField('lh', v)} />
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-400 leading-relaxed">
                            <p>ℹ️ <strong>Informação:</strong> O número do WhatsApp deve conter apenas números, incluindo o código do país (55) e o DDD.</p>
                          </div>
                        </div>
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

                      {activeTab === 'config' && (
                        <div className="space-y-8">
                          <h3 className="font-bebas text-xl text-white-primary/60 border-b border-white/5 pb-2 mb-6">Segurança e Auditoria</h3>
                          <div className="bg-yellow-primary/5 border border-yellow-primary/20 rounded-2xl p-8">
                            <h4 className="text-yellow-primary text-[0.7rem] font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
                              <ShieldCheck size={14} /> Auditoria e Transparência
                            </h4>
                            <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                              <div>
                                <p className="text-sm font-bold text-white-primary/80">Encerrar Apostas Manualmente</p>
                                <p className="text-xs text-white-primary/40">Bloqueia todas as novas apostas imediatamente.</p>
                              </div>
                              <button 
                                onClick={() => updateField('isBettingClosed', !data.isBettingClosed)}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${data.isBettingClosed ? 'bg-red-500' : 'bg-white/10'}`}
                              >
                                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${data.isBettingClosed ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                              <div>
                                <p className="text-sm font-bold text-white-primary/80">Liberar Apostas (Sobreposição)</p>
                                <p className="text-xs text-white-primary/40">Ignora o prazo e o fechamento automático para permitir apostas.</p>
                              </div>
                              <button 
                                onClick={() => updateField('isOverrideClosed', !data.isOverrideClosed)}
                                className={`w-14 h-8 rounded-full p-1 transition-colors ${data.isOverrideClosed ? 'bg-green-primary' : 'bg-white/10'}`}
                              >
                                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${data.isOverrideClosed ? 'translate-x-6' : 'translate-x-0'}`} />
                              </button>
                            </div>

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
                              <div className="flex items-end gap-4">
                                <div className="flex-1">
                                  <AdminField 
                                    label="Data/Hora Limite das Apostas" 
                                    type="datetime-local"
                                    value={data.deadline} 
                                    onChange={(v) => updateField('deadline', v)} 
                                  />
                                </div>
                                {data.deadline && (
                                  <button 
                                    onClick={() => updateField('deadline', '')}
                                    className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                    title="Limpar Prazo"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                )}
                              </div>
                              <p className="text-[0.6rem] text-white-primary/30 mt-2">
                                As apostas serão bloqueadas automaticamente após este horário.
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-sm text-white-primary/30 space-y-2">
                            <p>✅ Todas as alterações são salvas automaticamente no banco de dados.</p>
                            <p>✅ O painel administrativo agora é integrado diretamente na tela inicial para seu e-mail.</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="bg-[#0d1114] p-6 border-t border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => saveToStorage(data)}
                      className="bg-green-primary text-white font-bold px-10 py-3 rounded-lg hover:bg-green-dark transition-all flex items-center gap-2"
                    >
                      <Check size={18} /> Forçar Salvamento Geral
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
              </div>
            </div>
          </motion.section>
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
  </ErrorBoundary>
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
