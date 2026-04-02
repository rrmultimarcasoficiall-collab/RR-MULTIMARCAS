import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, query, where } from '../firebase';
import { UserProfile } from '../types';
import { UserCheck, UserX, Clock, Search, Smartphone, Calendar, Mail, Trash2, AlertTriangle } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Garantir que não haja duplicatas por UID (prevenção de erro de chave)
      const uniqueUsers = Array.from(new Map(usersData.map(u => [u.uid, u])).values());
      setUsers(uniqueUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error loading users in AdminUsers:', error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleResetBets = async (userId: string) => {
    try {
      // Deletar apostas do usuário
      const betsSnapshot = await getDocs(query(collection(db, 'bets'), where('userId', '==', userId)));
      const deletePromises = betsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Resetar flag no perfil
      await updateDoc(doc(db, 'users', userId), { betsSubmitted: false });
    } catch (error) {
      console.error('Error resetting user bets:', error);
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setLoading(true);
      // Deletar apostas do usuário
      const betsSnapshot = await getDocs(query(collection(db, 'bets'), where('userId', '==', userToDelete.uid)));
      const deletePromises = betsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Deletar documento do usuário
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  if (loading) return <div className="text-center py-12 text-white-primary/40">Carregando usuários...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="font-bebas text-3xl text-white">Gerenciamento de Usuários</h3>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou whatsapp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-green-primary transition-all text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredUsers.map(user => (
          <div key={user.uid} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                user.status === 'approved' ? 'bg-green-primary/20 text-green-primary' :
                user.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                'bg-yellow-primary/20 text-yellow-primary'
              }`}>
                <UserIcon size={24} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-lg">{user.displayName}</h4>
                  <span className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    user.status === 'approved' ? 'bg-green-primary/10 text-green-primary' :
                    user.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-primary/10 text-yellow-primary'
                  }`}>
                    {user.status === 'approved' ? 'Aprovado' : user.status === 'rejected' ? 'Recusado' : 'Pendente'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <div className="flex items-center gap-2 text-xs text-white-primary/40">
                    <Mail size={12} /> {user.email}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white-primary/40">
                    <Smartphone size={12} /> {user.phone || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white-primary/40">
                    <Calendar size={12} /> Nascimento: {user.birthDate ? new Date(user.birthDate).toLocaleDateString('pt-BR') : 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white-primary/40 text-green-primary font-bold">
                    <ShieldCheck size={12} /> Perfil: {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.role !== 'admin' && (
                <>
                  {user.status !== 'approved' && (
                    <button 
                      onClick={() => handleUpdateStatus(user.uid, 'approved')}
                      className="flex-1 md:flex-none px-4 py-2 bg-green-primary text-black font-bold rounded-xl hover:bg-green-primary/90 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <UserCheck size={18} /> Aprovar
                    </button>
                  )}
                  {user.status !== 'rejected' && (
                    <button 
                      onClick={() => handleUpdateStatus(user.uid, 'rejected')}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <UserX size={18} /> Recusar
                    </button>
                  )}
                  {user.status !== 'pending' && (
                    <button 
                      onClick={() => handleUpdateStatus(user.uid, 'pending')}
                      className="flex-1 md:flex-none px-4 py-2 bg-white/5 text-white/40 font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Clock size={18} /> Resetar Status
                    </button>
                  )}
                  {user.betsSubmitted && (
                    <button 
                      onClick={() => handleResetBets(user.uid)}
                      className="flex-1 md:flex-none px-4 py-2 bg-yellow-primary/10 text-yellow-primary border border-yellow-primary/20 font-bold rounded-xl hover:bg-yellow-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
                      title="Excluir palpites e permitir novos"
                    >
                      <Trash2 size={18} /> Resetar Tabela
                    </button>
                  )}
                  <button 
                    onClick={() => setUserToDelete(user)}
                    className="flex-1 md:flex-none p-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center"
                    title="Excluir Usuário"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
              {user.role === 'admin' && (
                <div className="px-4 py-2 bg-white/5 text-white/20 font-bold rounded-xl text-xs uppercase tracking-widest border border-white/5">
                  Protegido
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Modal de Confirmação de Exclusão */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6">
              <div className="flex items-center gap-4 text-red-500">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <h4 className="font-bebas text-2xl">Excluir Usuário?</h4>
              </div>
              
              <p className="text-white-primary/60 text-sm leading-relaxed">
                Você está prestes a excluir permanentemente o usuário <span className="text-white font-bold">{userToDelete.displayName}</span> ({userToDelete.email}). 
                Todas as apostas vinculadas a este usuário também serão removidas. Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 bg-white/2 rounded-3xl border border-dashed border-white/10">
            <p className="text-white-primary/20 italic">Nenhum usuário encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UserIcon({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldCheck({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
