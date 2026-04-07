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
  ArrowRight,
  LogOut
} from 'lucide-react';
import { BolaoData, UserProfile } from './types';
import { DEFAULT_BOLAO_DATA, STORAGE_KEY } from './constants';
import { supabase } from './supabase';
import AdminGames from './components/AdminGames';
import AdminUsers from './components/AdminUsers';
import AdminPayments from './components/AdminPayments';
import AdminTeams from './components/AdminTeams';
import ClientGames from './components/ClientGames';
import AuditView from './components/AuditView';

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
  const [completePhone, setCompletePhone] = useState('');
  const [completeError, setCompleteError] = useState('');
  const [completeLoading, setCompleteLoading] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAdminVisible, setIsAdminVisible] = useState(false);
  const [adminLoginData, setAdminLoginData] = useState({ email: '', password: '' });
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [guestId, setGuestId] = useState<string | null>(null);
  const profileChannelRef = useRef<any>(null);

  // Initialize guest ID
  useEffect(() => {
    let id = localStorage.getItem('bolao_guest_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('bolao_guest_id', id);
    }
    setGuestId(id);
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const typedEmail = adminLoginData.email.trim().toLowerCase();
    const typedPassword = adminLoginData.password;
    
    const isOfficialEmail = typedEmail === 'rrmultimarcasoficiall@gmail.com';
    // Definindo uma senha padrão simples para segurança inicial
    const isCorrectPassword = typedPassword === 'admin123';

    if (isOfficialEmail && isCorrectPassword) {
      setIsAdminLoggedIn(true);
      setShowAdminLogin(false);
      setAdminError('');
      setIsAdminVisible(true);
      setToast('Acesso administrativo liberado!');
    } else if (!isOfficialEmail) {
      setAdminError('E-mail não autorizado.');
    } else {
      setAdminError('Senha incorreta.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdminVisible(false);
  };

  // Scroll to top on mount and tab change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [userActiveTab]);

  // Check if profile needs completion
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      if (!userProfile.phone) {
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
    if (!completeName || !completePhone) {
      setCompleteError('Por favor, preencha todos os campos.');
      return;
    }
    setCompleteLoading(true);
    setCompleteError('');
    try {
      if (userProfile) {
        const updatedData = {
          display_name: completeName,
          phone: completePhone,
          status: 'pending'
        };
        const { error } = await supabase
          .from('profiles')
          .update(updatedData)
          .eq('id', userProfile.uid);
        
        if (error) throw error;

        setUserProfile({ 
          ...userProfile, 
          displayName: completeName,
          phone: completePhone,
          status: 'pending'
        });
        setIsCompletingProfile(false);
        setToast('Perfil atualizado! Aguarde a aprovação.');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setCompleteError('Erro ao atualizar perfil. Tente novamente.');
    } finally {
      setCompleteLoading(false);
    }
  };

  // Sync Auth State
  useEffect(() => {
    const syncAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const handleUser = async (user: any) => {
          try {
            if (user) {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

              if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
                setUserProfile(null);
                return;
              }

              let profile: UserProfile;
              if (profileData) {
                profile = {
                  uid: profileData.id,
                  email: profileData.email,
                  displayName: profileData.display_name,
                  role: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : profileData.role,
                  status: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : profileData.status,
                  birthDate: profileData.birth_date,
                  phone: profileData.phone,
                  betsSubmitted: profileData.bets_submitted,
                  paymentStatus: profileData.payment_status,
                  rejectionMessage: profileData.rejection_message
                };
              } else {
                // Profile should be created by the trigger, but as a fallback:
                profile = {
                  uid: user.id,
                  email: user.email || '',
                  displayName: user.user_metadata?.display_name || 'Usuário',
                  role: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
                  status: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
                };
                await supabase.from('profiles').upsert({
                  id: profile.uid,
                  email: profile.email,
                  display_name: profile.displayName,
                  role: profile.role,
                  status: profile.status
                });
              }

              setUserProfile(profile);

              // Real-time listener for user profile
              if (profileChannelRef.current) {
                supabase.removeChannel(profileChannelRef.current);
              }

              const channel = supabase
                .channel(`profile:${user.id}`)
                .on('postgres_changes', { 
                  event: 'UPDATE', 
                  schema: 'public', 
                  table: 'profiles',
                  filter: `id=eq.${user.id}`
                }, (payload) => {
                  const updated = payload.new as any;
                  setUserProfile(prev => prev ? {
                    ...prev,
                    displayName: updated.display_name,
                    role: updated.role,
                    status: updated.status,
                    birthDate: updated.birth_date,
                    phone: updated.phone,
                    betsSubmitted: updated.bets_submitted,
                    paymentStatus: updated.payment_status,
                    rejectionMessage: updated.rejection_message
                  } : null);
                });
              
              profileChannelRef.current = channel;
              channel.subscribe();
            } else {
              if (profileChannelRef.current) {
                supabase.removeChannel(profileChannelRef.current);
                profileChannelRef.current = null;
              }
              setUserProfile(null);
            }
          } catch (err) {
            console.error('Error in handleUser:', err);
            setUserProfile(null);
          } finally {
            setIsAuthReady(true);
          }
        };

        if (session?.user) {
          await handleUser(session.user);
        } else {
          setIsAuthReady(true);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          await handleUser(session?.user || null);
        });

        return () => {
          subscription.unsubscribe();
          if (profileChannelRef.current) {
            supabase.removeChannel(profileChannelRef.current);
          }
        };
      } catch (err) {
        console.error('Error in syncAuth:', err);
        setIsAuthReady(true);
      }
    };

    syncAuth();
  }, []);

  // Load data from Supabase
  useEffect(() => {
    const fetchConfig = async () => {
      const { data: configData, error } = await supabase
        .from('config')
        .select('*')
        .eq('id', 'main')
        .single();

      if (error) {
        console.error('Error fetching config:', error);
        return;
      }

      if (configData) {
        setData(prev => ({
          ...prev,
          pixKey: configData.pix_key,
          pricePerTicket: configData.price_per_ticket,
          wn: configData.whatsapp_number,
          lh: configData.group_link,
          loginImg: configData.login_img,
          loginBadge: configData.login_badge,
          loginTitle1: configData.login_title1,
          loginTitle2: configData.login_title2,
          loginSub: configData.login_sub,
          foot: configData.footer_text,
          isBettingClosed: configData.is_betting_closed,
          isAuditReady: configData.is_audit_ready,
          isOverrideClosed: configData.is_override_closed,
          nextRoundTitle: configData.next_round_title,
          nextRoundDate: configData.next_round_date,
          nextRoundTime: configData.next_round_time,
          deadline: configData.deadline
        }));
      }
    };

    fetchConfig();

    const channel = supabase
      .channel('config_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'config',
        filter: 'id=eq.main'
      }, (payload) => {
        const updated = payload.new as any;
        setData(prev => ({
          ...prev,
          pixKey: updated.pix_key,
          pricePerTicket: updated.price_per_ticket,
          wn: updated.whatsapp_number,
          lh: updated.group_link,
          loginImg: updated.login_img,
          loginBadge: updated.login_badge,
          loginTitle1: updated.login_title1,
          loginTitle2: updated.login_title2,
          loginSub: updated.login_sub,
          foot: updated.footer_text,
          isBettingClosed: updated.is_betting_closed,
          isAuditReady: updated.is_audit_ready,
          isOverrideClosed: updated.is_override_closed,
          nextRoundTitle: updated.next_round_title,
          nextRoundDate: updated.next_round_date,
          nextRoundTime: updated.next_round_time,
          deadline: updated.deadline
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize config if admin and not exists
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const checkAndInit = async () => {
        const { data, error } = await supabase
          .from('config')
          .select('id')
          .eq('id', 'main')
          .single();
        
        if (error && error.code === 'PGRST116') {
          await supabase.from('config').insert({
            id: 'main',
            pix_key: DEFAULT_BOLAO_DATA.pixKey,
            price_per_ticket: DEFAULT_BOLAO_DATA.pricePerTicket,
            whatsapp_number: DEFAULT_BOLAO_DATA.wn,
            group_link: DEFAULT_BOLAO_DATA.lh,
            login_img: DEFAULT_BOLAO_DATA.loginImg,
            login_badge: DEFAULT_BOLAO_DATA.loginBadge,
            login_title1: DEFAULT_BOLAO_DATA.loginTitle1,
            login_title2: DEFAULT_BOLAO_DATA.loginTitle2,
            login_sub: DEFAULT_BOLAO_DATA.loginSub,
            footer_text: DEFAULT_BOLAO_DATA.foot,
            is_betting_closed: DEFAULT_BOLAO_DATA.isBettingClosed,
            is_audit_ready: DEFAULT_BOLAO_DATA.isAuditReady,
            is_override_closed: DEFAULT_BOLAO_DATA.isOverrideClosed,
            next_round_title: DEFAULT_BOLAO_DATA.nextRoundTitle,
            next_round_date: DEFAULT_BOLAO_DATA.nextRoundDate,
            next_round_time: DEFAULT_BOLAO_DATA.nextRoundTime,
            deadline: DEFAULT_BOLAO_DATA.deadline
          });
        }
      };
      checkAndInit();
    }
  }, [userProfile]);

  const saveToStorage = async (newData: BolaoData) => {
    try {
      const { error } = await supabase
        .from('config')
        .update({
          pix_key: newData.pixKey,
          price_per_ticket: newData.pricePerTicket,
          whatsapp_number: newData.wn,
          group_link: newData.lh,
          login_img: newData.loginImg,
          login_badge: newData.loginBadge,
          login_title1: newData.loginTitle1,
          login_title2: newData.loginTitle2,
          login_sub: newData.loginSub,
          footer_text: newData.foot,
          is_betting_closed: newData.isBettingClosed,
          is_audit_ready: newData.isAuditReady,
          is_override_closed: newData.isOverrideClosed,
          next_round_title: newData.nextRoundTitle,
          next_round_date: newData.nextRoundDate,
          next_round_time: newData.nextRoundTime,
          deadline: newData.deadline
        })
        .eq('id', 'main');
      
      if (error) throw error;
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

  const isDeadlinePassed = data.deadline && new Date() > new Date(data.deadline.includes('T') ? data.deadline + ":00Z" : data.deadline);
  const isAuditOpen = data.isAuditReady || isDeadlinePassed;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-dark-primary text-white-primary selection:bg-green-primary selection:text-white">
        <AnimatePresence mode="wait">
          {!isAuthReady ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen flex items-center justify-center"
            >
              <div className="w-12 h-12 border-4 border-green-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : (
            <motion.div 
              key="app-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="fixed top-8 right-8 z-50 flex items-center gap-4">
                {isAdminLoggedIn ? (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsAdminVisible(!isAdminVisible)}
                      className={`bg-zinc-900/80 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl ${isAdminVisible ? 'text-green-primary border-green-primary/50' : 'text-white-primary/70 hover:text-green-primary'}`}
                    >
                      <Settings size={16} />
                      <span className="hidden md:inline">{isAdminVisible ? 'Ocultar Configurações' : 'Mostrar Configurações'}</span>
                    </button>
                    <button 
                      onClick={handleAdminLogout}
                      className="bg-red-500/20 border border-red-500/30 text-red-500 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    >
                      Sair Admin
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setAdminLoginData({ email: '', password: '' });
                      setAdminError('');
                      setShowAdminLogin(true);
                    }}
                    className="bg-zinc-900/80 backdrop-blur-sm border border-white/10 px-4 py-2.5 rounded-xl text-white-primary/70 hover:text-green-primary transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl"
                  >
                    <Lock size={16} />
                    <span className="hidden md:inline">Painel Admin</span>
                  </button>
                )}
              </div>

              {/* Admin Login Modal */}
              <AnimatePresence>
                {showAdminLogin && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-[#111b21] border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
                    >
                      <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-green-primary/20 rounded-full flex items-center justify-center mx-auto text-green-primary mb-4">
                          <Lock size={32} />
                        </div>
                        <h2 className="font-bebas text-4xl text-white">Acesso Restrito</h2>
                        <p className="text-white-primary/60 text-sm">Somente administradores autorizados.</p>
                      </div>

                      <form onSubmit={handleAdminLogin} className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">E-mail de Admin</label>
                            <input 
                              type="email" 
                              value={adminLoginData.email}
                              onChange={(e) => setAdminLoginData({ ...adminLoginData, email: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 outline-none focus:border-green-primary transition-all text-sm text-white"
                              placeholder="Digite seu e-mail"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Senha de Acesso</label>
                            <input 
                              type="password" 
                              value={adminLoginData.password}
                              onChange={(e) => setAdminLoginData({ ...adminLoginData, password: e.target.value })}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 outline-none focus:border-green-primary transition-all text-sm text-white"
                              placeholder="••••••••"
                              required
                            />
                          </div>
                        </div>

                        {adminError && (
                          <p className="text-red-400 text-xs font-bold text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{adminError}</p>
                        )}

                        <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setShowAdminLogin(false)}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 py-4 bg-green-primary hover:bg-green-600 text-black font-bold rounded-2xl transition-all shadow-lg"
                          >
                            Entrar no Painel
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {isCompletingProfile ? (
                  <motion.div 
                    key="profile-completion"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-[#0b141a] overflow-y-auto"
                  >
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
                    onClick={() => supabase.auth.signOut()}
                    className="w-full py-2 text-white-primary/40 hover:text-white-primary/60 text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Sair da Conta
                  </button>
                </form>
              </motion.div>
            </motion.div>
          ) : userProfile?.status === 'pending' && userProfile?.role === 'user' ? (
            <motion.div 
              key="pending-approval"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-[#0b141a] overflow-y-auto"
            >
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
                  onClick={() => supabase.auth.signOut()}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                >
                  Sair da Conta
                </button>
              </motion.div>
            </motion.div>
          ) : userProfile?.status === 'rejected' && userProfile?.role === 'user' ? (
            <motion.div 
              key="rejected-access"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-[#0b141a]"
            >
              <div className="max-w-md w-full bg-[#111b21] border border-red-500/20 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <X size={40} />
                </div>
                <h2 className="font-bebas text-4xl text-white">Acesso Negado</h2>
                <p className="text-white-primary/60 text-sm">
                  Sua conta foi recusada pelo administrador. Entre em contato para mais informações.
                </p>
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                >
                  Sair da Conta
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="main-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Client Area */}
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
                      {isAuditOpen && (
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
                        <Trophy size={18} />
                      </div>
                      <div>
                        <div className="text-[0.55rem] md:text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">Seu Desempenho</div>
                        <div className="font-bebas text-xl md:text-2xl text-white-primary">{userHits} / 8 Acertos</div>
                      </div>
                    </div>
                  </div>
                </div>

                {(userActiveTab === 'jogos' || !isAuditOpen) ? (
                  <ClientGames 
                    userId={guestId || ''} 
                    userProfile={isAdminLoggedIn ? userProfile : null} 
                    onHitsUpdate={setUserHits} 
                    data={data} 
                  />
                ) : (
                  <AuditView currentUser={userProfile} />
                )}
              </motion.section>

              {/* Admin Panel */}
              <AnimatePresence>
                {isAdminLoggedIn && isAdminVisible && (
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
                          {['links', 'jogos', 'escudos', 'usuarios', 'pagamentos', 'config'].map((tab) => (
                            <button 
                              key={tab}
                              onClick={() => setActiveTab(tab)}
                              className={`px-6 py-4 text-[0.7rem] font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? 'text-green-primary border-green-primary' : 'text-white-primary/40 border-transparent hover:text-white-primary/70'}`}
                            >
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

              {/* Footer */}
              <footer className="py-12 px-8 border-t border-white/5 text-center">
                <p className="text-sm text-white-primary/30">{data.foot}</p>
                <div className="mt-4 text-[10px] text-white/10 font-mono">
                  State: {isAuthReady ? 'Ready' : 'Loading'} | Admin: {isAdminLoggedIn ? 'Yes' : 'No'} | Guest: {guestId?.substring(0, 8)}...
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )}
  </AnimatePresence>
</div>
</ErrorBoundary>
);
}

function AdminField({ label, value, onChange, isTextArea, type = 'text', isImage }: { label: string, value: string, onChange: (v: string) => void, isTextArea?: boolean, type?: string, isImage?: boolean }) {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // ~800KB limit to stay safe with Firestore 1MB limit
        setError('Imagem muito grande (>800KB)');
        setTimeout(() => setError(null), 3000);
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
      <div className="flex items-center justify-between">
        <label className="block text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">{label}</label>
        {error && <span className="text-[0.6rem] text-red-500 font-bold animate-pulse">{error}</span>}
      </div>
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
