import React, { useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  db,
  doc,
  getDoc,
  setDoc
} from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  User as UserIcon, 
  AlertCircle, 
  CheckCircle2,
  Trophy,
  ChevronLeft,
  Calendar,
  Smartphone
} from 'lucide-react';
import { UserProfile, BolaoData } from '../types';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
  data: BolaoData;
}

export default function LoginView({ onLoginSuccess, data }: LoginViewProps) {
  const [isRegistering, setIsRegistering] = useState(() => {
    // Default to registration for new users
    return !localStorage.getItem('bolao_has_account');
  });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSuccess = (profile: UserProfile) => {
    localStorage.setItem('bolao_has_account', 'true');
    onLoginSuccess(profile);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let profile: UserProfile;
      
      if (!userDoc.exists()) {
        profile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Usuário',
          role: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
          status: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
        };
        await setDoc(doc(db, 'users', user.uid), profile);
      } else {
        profile = userDoc.data() as UserProfile;
        // Force admin for specific email
        if (user.email === 'rrmultimarcasoficiall@gmail.com') {
          profile.role = 'admin';
          profile.status = 'approved';
        }
      }

      if (profile.status === 'rejected') {
        setError('Sua conta foi recusada pelo administrador.');
        await auth.signOut();
        return;
      }

      handleSuccess(profile);
    } catch (err: any) {
      setError('Falha ao entrar com Google. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isRegistering) {
        if (!name || !birthDate || !phone) {
          setError('Por favor, preencha todos os campos obrigatórios.');
          setLoading(false);
          return;
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const profile: UserProfile = {
          uid: result.user.uid,
          email: email,
          displayName: name,
          birthDate: birthDate,
          phone: phone,
          role: email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
          status: email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
        };
        await setDoc(doc(db, 'users', result.user.uid), profile);
        handleSuccess(profile);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        let profile: UserProfile;
        
        if (userDoc.exists()) {
          profile = userDoc.data() as UserProfile;
          if (email === 'rrmultimarcasoficiall@gmail.com' && profile.role !== 'admin') {
            profile.role = 'admin';
            profile.status = 'approved';
          }
        } else {
          profile = {
            uid: result.user.uid,
            email: email,
            displayName: 'Usuário',
            role: email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
            status: email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
          };
          await setDoc(doc(db, 'users', result.user.uid), profile);
        }

        if (profile.status === 'rejected') {
          setError('Sua conta foi recusada pelo administrador.');
          await auth.signOut();
          return;
        }

        handleSuccess(profile);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O cadastro por e-mail ainda não foi ativado no Firebase. Por favor, use o botão "Entrar com Google" ou peça ao administrador para ativar o provedor de E-mail/Senha no Console do Firebase.');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      setError('Erro ao enviar e-mail. Verifique se o endereço está correto.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col md:flex-row bg-[#0a0d10] overflow-y-auto md:overflow-hidden">
      {/* Left Side: Visual Background */}
      <div className="relative w-full md:w-1/2 lg:w-[60%] h-[30vh] md:h-full shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d10] via-transparent to-transparent z-10 md:hidden" />
        
        {/* Background Image */}
        <img 
          src={data.loginImg} 
          alt="Login Background"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />

        {/* Overlay Content */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end p-8 md:p-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="inline-flex items-center gap-2 bg-green-primary text-white text-[0.6rem] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4">
              <Trophy size={12} /> {data.loginBadge}
            </div>
            <h1 className="font-bebas text-6xl md:text-8xl lg:text-9xl leading-[0.85] text-white mb-4">
              {data.loginTitle1} <span className="text-green-primary">{data.loginTitle2}</span>
            </h1>
            <p className="text-white-primary/60 max-w-md text-sm md:text-lg font-medium">
              {data.loginSub}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full md:w-1/2 lg:w-[40%] min-h-[70vh] md:h-full flex items-center justify-start md:justify-center px-6 py-12 md:p-12 bg-[#0a0d10] relative z-30">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-10">
            <h2 className="font-bebas text-4xl text-white mb-2">
              {isForgotPassword ? 'Recuperar Senha' : (isRegistering ? 'Cadastre-se' : 'Acesse sua conta')}
            </h2>
            <p className="text-white-primary/40 text-sm">
              {isForgotPassword 
                ? 'Enviaremos um link para o seu e-mail' 
                : (isRegistering ? 'Crie sua conta para começar a jogar' : 'Entre com sua conta para continuar')}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{error}</p>
            </motion.div>
          )}

          {message && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl flex items-start gap-3 mb-6"
            >
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs font-medium">{message}</p>
            </motion.div>
          )}

          <form onSubmit={isForgotPassword ? handleResetPassword : handleEmailAuth} className="space-y-4">
            {isRegistering && !isForgotPassword && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-white"
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Data de Nascimento</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
                      <input 
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">WhatsApp</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
                      <input 
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-white"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-white"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 ml-1">Senha</label>
                  {!isRegistering && (
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-[0.65rem] font-bold uppercase tracking-widest text-green-primary hover:text-green-dark transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-primary focus:bg-white/10 transition-all text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-green-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-dark transition-all shadow-[0_8px_24px_rgba(0,200,83,0.2)] hover:shadow-[0_12px_32px_rgba(0,200,83,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? 'Processando...' : (isForgotPassword ? 'Enviar Link' : (isRegistering ? 'Criar Minha Conta' : 'Entrar na Plataforma'))}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {isForgotPassword ? (
            <button 
              onClick={() => setIsForgotPassword(false)}
              className="w-full flex items-center justify-center gap-2 text-white-primary/40 hover:text-white-primary/60 text-xs font-bold uppercase tracking-widest mt-8"
            >
              <ChevronLeft size={16} /> Voltar para o login
            </button>
          ) : (
            <>
              <div className="relative my-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-[0.6rem] uppercase tracking-[0.2em] font-bold">
                  <span className="bg-[#0a0d10] px-4 text-white-primary/20">Ou continue com</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Entrar com Google
              </button>

              <div className="mt-10 mb-12 p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-white-primary/40 text-xs font-medium mb-3">
                  {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                </p>
                <button 
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="w-full py-3 rounded-xl border border-green-primary/30 text-green-primary font-bold text-xs uppercase tracking-widest hover:bg-green-primary/10 transition-all"
                >
                  {isRegistering ? 'Fazer Login' : 'Cadastre-se agora'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
