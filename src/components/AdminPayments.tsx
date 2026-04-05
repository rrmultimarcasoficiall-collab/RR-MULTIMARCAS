import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, updateDoc, doc, deleteDoc, setDoc } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Cartela } from '../types';
import { Check, X, Clock, User, Trash2, Search, Filter, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PaymentTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminPayments() {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PaymentTab>('pending');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cartelas'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cartela));
      setCartelas(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cartelas');
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredCartelas = useMemo(() => {
    return cartelas.filter(c => {
      const matchesSearch = 
        c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.userId.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || c.paymentStatus === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [cartelas, searchQuery, activeTab]);

  const handleApprove = async (cartela: Cartela) => {
    try {
      await updateDoc(doc(db, 'cartelas', cartela.id), { paymentStatus: 'approved' });
      await updateDoc(doc(db, 'users', cartela.userId), { 
        paymentStatus: 'approved',
        betsSubmitted: true 
      });

      const savePromises = Object.entries(cartela.predictions).map(([gameId, prediction]) => {
        const betId = `${cartela.userId}_${gameId}`;
        return setDoc(doc(db, 'bets', betId), {
          userId: cartela.userId,
          gameId,
          prediction,
          timestamp: new Date().toISOString()
        });
      });
      await Promise.all(savePromises);
    } catch (error) {
      console.error('Error approving payment:', error);
    }
  };

  const handleReject = async (cartela: Cartela) => {
    try {
      await updateDoc(doc(db, 'cartelas', cartela.id), { paymentStatus: 'rejected' });
      await updateDoc(doc(db, 'users', cartela.userId), { 
        paymentStatus: 'none',
        betsSubmitted: false 
      });
    } catch (error) {
      console.error('Error rejecting payment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cartelas', id));
    } catch (error) {
      console.error('Error deleting cartela:', error);
    }
  };

  if (loading) return <div className="p-8 text-center text-white-primary/40 uppercase tracking-widest text-xs font-bold">Carregando pagamentos...</div>;

  const stats = {
    all: cartelas.length,
    pending: cartelas.filter(c => c.paymentStatus === 'pending').length,
    approved: cartelas.filter(c => c.paymentStatus === 'approved').length,
    rejected: cartelas.filter(c => c.paymentStatus === 'rejected').length,
  };

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="font-bebas text-3xl text-white-primary tracking-wider flex items-center gap-3">
            <CreditCard size={28} className="text-green-primary" /> Gestão de Pagamentos
          </h3>
          <p className="text-white-primary/40 text-xs font-bold uppercase tracking-widest mt-1">Controle de cartelas e liberações</p>
        </div>

        <div className="relative group w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20 group-focus-within:text-green-primary transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por usuário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white-primary placeholder:text-white-primary/20 focus:outline-none focus:border-green-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
        {[
          { id: 'pending', label: 'Pendentes', count: stats.pending, color: 'text-yellow-primary' },
          { id: 'approved', label: 'Aprovados', count: stats.approved, color: 'text-green-primary' },
          { id: 'rejected', label: 'Recusados', count: stats.rejected, color: 'text-red-500' },
          { id: 'all', label: 'Todos', count: stats.all, color: 'text-white-primary/60' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as PaymentTab)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[0.65rem] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex-1 justify-center ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/80 hover:bg-white/5'}`}
          >
            <span className={activeTab === tab.id ? tab.color : ''}>{tab.label}</span>
            <span className="bg-white/5 px-2 py-0.5 rounded-md text-[0.6rem]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filteredCartelas.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center bg-white/2 border border-dashed border-white/10 rounded-3xl"
            >
              <Filter size={40} className="mx-auto text-white-primary/10 mb-4" />
              <p className="text-white-primary/20 text-sm italic">Nenhum pagamento encontrado nesta categoria.</p>
            </motion.div>
          ) : (
            filteredCartelas.map(c => (
              <motion.div 
                key={c.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/8 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    c.paymentStatus === 'approved' ? 'bg-green-primary/10 text-green-primary' :
                    c.paymentStatus === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-primary/10 text-yellow-primary'
                  }`}>
                    <User size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white-primary flex items-center gap-2">
                      {c.userName}
                      {c.paymentStatus === 'approved' && <Check size={14} className="text-green-primary" />}
                      {c.paymentStatus === 'rejected' && <X size={14} className="text-red-500" />}
                    </h4>
                    <p className="text-xs text-white-primary/40">{new Date(c.timestamp).toLocaleString('pt-BR')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-12">
                  <div className="text-center">
                    <p className="text-[0.6rem] text-white-primary/40 uppercase font-bold tracking-widest mb-1">Qtd</p>
                    <p className="font-bebas text-xl">{c.quantity}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[0.6rem] text-white-primary/40 uppercase font-bold tracking-widest mb-1">Valor</p>
                    <p className="font-bebas text-xl text-green-primary">R$ {c.totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-[0.6rem] text-white-primary/40 uppercase font-bold tracking-widest mb-1">Status</p>
                    <span className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                      c.paymentStatus === 'approved' ? 'bg-green-primary/10 text-green-primary' :
                      c.paymentStatus === 'rejected' ? 'bg-red-500/10 text-red-500' :
                      'bg-yellow-primary/10 text-yellow-primary'
                    }`}>
                      {c.paymentStatus === 'approved' ? 'Aprovado' : c.paymentStatus === 'rejected' ? 'Recusado' : 'Pendente'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {c.paymentStatus === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleReject(c)}
                        className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Rejeitar"
                      >
                        <X size={20} />
                      </button>
                      <button 
                        onClick={() => handleApprove(c)}
                        className="flex-1 md:flex-none px-6 py-3 bg-green-primary text-black font-black rounded-xl hover:scale-105 transition-all flex items-center gap-2"
                      >
                        <Check size={20} /> APROVAR
                      </button>
                    </>
                  )}
                  
                  {c.paymentStatus !== 'pending' && (
                    <div className="flex items-center gap-2">
                      <span className={`md:hidden text-[0.6rem] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                        c.paymentStatus === 'approved' ? 'bg-green-primary/10 text-green-primary' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {c.paymentStatus === 'approved' ? 'Aprovado' : 'Recusado'}
                      </span>
                    </div>
                  )}

                  <button 
                    onClick={() => handleDelete(c.id)}
                    className="p-3 bg-white/5 text-white-primary/20 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                    title="Excluir Registro"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
