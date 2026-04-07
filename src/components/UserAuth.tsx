import React, { useState } from 'react';
import { supabase } from '../supabase';
import { UserProfile } from '../types';
import { LogIn, LogOut, User as UserIcon, AlertCircle } from 'lucide-react';

interface UserAuthProps {
  userProfile: UserProfile | null;
  onProfileUpdate: (profile: UserProfile | null) => void;
}

export default function UserAuth({ userProfile, onProfileUpdate }: UserAuthProps) {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    // Google login removed as requested
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onProfileUpdate(null);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-4">
        {userProfile ? (
          <div className="flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 rounded-full pl-1.5 md:pl-2 pr-3 md:pr-4 py-1 md:py-1.5">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-green-primary/20 flex items-center justify-center text-green-primary shrink-0">
              <UserIcon size={14} md:size={16} />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[0.65rem] md:text-xs font-bold text-white-primary/80 leading-none truncate max-w-[80px] md:max-w-none">{userProfile.displayName}</div>
              <div className="text-[0.55rem] md:text-[0.6rem] text-white-primary/40 uppercase tracking-widest">{userProfile.role}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="ml-1 md:ml-2 p-1 md:p-1.5 rounded-full hover:bg-red-500/20 text-white-primary/40 hover:text-red-400 transition-colors shrink-0"
              title="Sair"
            >
              <LogOut size={12} md:size={14} />
            </button>
          </div>
        ) : null}
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
