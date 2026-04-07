import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Cartela } from '../types';
import { Check, X, User, Trash2, Search, Filter, CreditCard, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PaymentTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminPayments() {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<PaymentTab>('pending');
  const [cartelaToDelete, setCartelaToDelete] = useState<Cartela | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCartelas = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('cartelas')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Error fetching cartelas:', error);
        setCartelas([]);
      } else {
        const formattedData = (data || []).map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name,
          userWhatsapp: item.user_whatsapp,
          quantity: item.quantity,
          totalAmount: item.total_amount,
          paymentStatus: item.payment_status,
          timestamp: item.timestamp,
          predictions: item.predictions
        } as Cartela));

        setCartelas(formattedData);
      }
    } catch (error) {
      console.error('Error fetching cartelas:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCartelas();

    // Safety timeout to prevent stuck loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  const filteredCartelas = useMemo(() => {
    return cartelas.filter(c => {
      const matchesSearch = 
        c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.userWhatsapp && c.userWhatsapp.includes(searchQuery));
      
      const matchesTab = activeTab === 'all' || c.paymentStatus === activeTab;
      
      return matchesSearch && matchesTab;
    });
  }, [cartelas, searchQuery, activeTab]);

  const handleApprove = async (cartela: Cartela) => {
    try {
      // 1. Update cartela status
      const { error: cartelaError } = await supabase
        .from('cartelas')
        .update({ payment_status: 'approved' })
        .eq('id', cartela.id);
      if (cartelaError) throw cartelaError;

      // 2. Update user profile (optional for guests)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', cartela.userId)
        .single();

      if (profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            payment_status: 'approved',
            bets_submitted: true,
            rejection_message: null
          })
          .eq('id', cartela.userId);
        if (profileError) throw profileError;
      }

      // 3. Save bets
      const betsToInsert = Object.entries(cartela.predictions).map(([gameId, prediction]) => ({
        id: `${cartela.userId}_${gameId}`,
        user_id: cartela.userId,
        game_id: gameId,
        prediction,
        timestamp: new Date().toISOString()
      }));

      const { error: betsError } = await supabase
        .from('bets')
        .upsert(betsToInsert);
      if (betsError) throw betsError;
      
      // Update local state
      setCartelas(prev => prev.map(c => c.id === cartela.id ? { ...c, paymentStatus: 'approved' } : c));
    } catch (error) {
      console.error('Error approving payment:', error);
    }
  };

  const handleReject = async (cartela: Cartela) => {
    try {
      const { error: cartelaError } = await supabase
        .from('cartelas')
        .update({ payment_status: 'rejected' })
        .eq('id', cartela.id);
      if (cartelaError) throw cartelaError;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', cartela.userId)
        .single();

      if (profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            payment_status: 'rejected',
            bets_submitted: false,
            rejection_message: 'Seu pagamento foi recusado. Por favor, verifique o comprovante e tente novamente.'
          })
          .eq('id', cartela.userId);
        if (profileError) throw profileError;
      }

      // Update local state
      setCartelas(prev => prev.map(c => c.id === cartela.id ? { ...c, paymentStatus: 'rejected' } : c));
    } catch (error) {
      console.error('Error rejecting payment:', error);
    }
  };

  const handleDelete = async () => {
    if (!cartelaToDelete) return;
    try {
      const { error: deleteError } = await supabase
        .from('cartelas')
        .delete()
        .eq('id', cartelaToDelete.id);
      if (deleteError) throw deleteError;

      // Reset user status so they can pay again (optional for guests)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', cartelaToDelete.userId)
        .single();

      if (profile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            payment_status: 'none',
            bets_submitted: false,
            rejection_message: null
          })
          .eq('id', cartelaToDelete.userId);
        if (profileError) throw profileError;
      }

      // Update local state
      setCartelas(prev => prev.filter(c => c.id !== cartelaToDelete.id));
      setCartelaToDelete(null);
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
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-bebas text-3xl text-white-primary tracking-wider flex items-center gap-3">
              <CreditCard size={28} className="text-green-primary" /> Gestão de Pagamentos
            </h3>
            <p className="text-white-primary/40 text-xs font-bold uppercase tracking-widest mt-1">Controle de cartelas e liberações</p>
          </div>
          <button 
            onClick={fetchCartelas}
            disabled={isRefreshing}
            className="p-2 bg-white/5 text-white-primary/40 rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            title="Atualizar Lista"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
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
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-white-primary/40">{new Date(c.timestamp).toLocaleString('pt-BR')}</p>
                      {c.userWhatsapp && (
                        <p className="text-xs text-green-primary/60 font-bold">WPP: {c.userWhatsapp}</p>
                      )}
                    </div>
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
                    onClick={() => setCartelaToDelete(c)}
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

      {/* Modal de Confirmação de Exclusão */}
      {cartelaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6">
            <div className="flex items-center gap-4 text-red-500">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <h4 className="font-bebas text-2xl">Excluir Registro?</h4>
            </div>
            
            <p className="text-white-primary/60 text-sm leading-relaxed">
              Tem certeza que deseja excluir o registro de pagamento de <span className="text-white font-bold">{cartelaToDelete.userName}</span>? 
              O usuário poderá enviar um novo comprovante após a exclusão.
            </p>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setCartelaToDelete(null)}
                className="flex-1 px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
