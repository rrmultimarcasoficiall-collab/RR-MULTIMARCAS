import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, db, doc, getDoc, setDoc } from '../firebase';
import { UserProfile } from '../types';
import { LogIn, LogOut, User as UserIcon, AlertCircle } from 'lucide-react';

interface UserAuthProps {
  userProfile: UserProfile | null;
  onProfileUpdate: (profile: UserProfile | null) => void;
}

export default function UserAuth({ userProfile, onProfileUpdate }: UserAuthProps) {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Usuário',
          role: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'admin' : 'user',
          status: user.email === 'rrmultimarcasoficiall@gmail.com' ? 'approved' : 'pending'
        };
        await setDoc(doc(db, 'users', user.uid), newProfile);
        onProfileUpdate(newProfile);
      } else {
        const profile = userDoc.data() as UserProfile;
        // Force admin for specific email
        if (user.email === 'rrmultimarcasoficiall@gmail.com') {
          profile.role = 'admin';
          profile.status = 'approved';
          await setDoc(doc(db, 'users', user.uid), profile);
        }
        onProfileUpdate(profile);
      }
    } catch (error: any) {
      console.error('Login error', error);
      setError(error.message || 'Erro ao entrar com Google. Verifique se o pop-up foi bloqueado.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    onProfileUpdate(null);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-4">
        {userProfile ? (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full pl-2 pr-4 py-1.5">
            <div className="w-8 h-8 rounded-full bg-green-primary/20 flex items-center justify-center text-green-primary">
              <UserIcon size={16} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-white-primary/80 leading-none">{userProfile.displayName}</div>
              <div className="text-[0.6rem] text-white-primary/40 uppercase tracking-widest">{userProfile.role}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="ml-2 p-1.5 rounded-full hover:bg-red-500/20 text-white-primary/40 hover:text-red-400 transition-colors"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="inline-flex items-center gap-2 bg-white/10 text-white font-bold px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/20 transition-all"
          >
            <LogIn size={18} />
            Entrar com Google
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-[0.65rem] bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}
