import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, onSnapshot, query, where, updateDoc, addDoc } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Game, Bet, BolaoData, UserProfile, Cartela } from '../types';
import { Check, Clock, Trophy, AlertCircle, Save, AlertTriangle, CreditCard, Copy, ExternalLink, QrCode, DollarSign, User, Calendar, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePixPayload } from '../lib/pix';

interface ClientGamesProps {
  userId: string;
  userProfile: UserProfile | null;
  onHitsUpdate?: (hits: number) => void;
  data: BolaoData;
}

export default function ClientGames({ userId, userProfile, onHitsUpdate, data }: ClientGamesProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [localBets, setLocalBets] = useState<Record<string, 'win1' | 'draw' | 'win2'>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'my-bets'>('all');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pixPayload, setPixPayload] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [pendingCartela, setPendingCartela] = useState<Cartela | null>(null);
  const [approvedCartelas, setApprovedCartelas] = useState<Cartela[]>([]);

  const PIX_KEY = data.pixKey || '3c496ef8-44bd-4cc7-87b4-a2c950ca2e03';
  const PRICE_PER_TICKET = data.pricePerTicket || 10;

  useEffect(() => {
    if (!userId) return;

    // Fetch approved cartelas for transparency
    const qApproved = query(collection(db, 'cartelas'), where('paymentStatus', '==', 'approved'));
    const unsubApproved = onSnapshot(qApproved, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cartela));
      setApprovedCartelas(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cartelas (approved)');
    });

    // Fetch games
    const unsubGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      // Garantir que não haja duplicatas por ID
      const uniqueGames = Array.from(new Map(gamesData.map(g => [g.id, g])).values());
      setGames(uniqueGames.sort((a, b) => a.order - b.order));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
      setLoading(false);
    });

    // Fetch user bets
    const q = query(collection(db, 'bets'), where('userId', '==', userId));
    const unsubBets = onSnapshot(q, (snapshot) => {
      const betsData: Record<string, Bet> = {};
      const localData: Record<string, 'win1' | 'draw' | 'win2'> = {};
      snapshot.docs.forEach(doc => {
        const bet = { id: doc.id, ...doc.data() } as Bet;
        betsData[bet.gameId] = bet;
        localData[bet.gameId] = bet.prediction;
      });
      setBets(betsData);
      setLocalBets(localData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    // Fetch pending cartela
    const qCartelas = query(collection(db, 'cartelas'), where('userId', '==', userId), where('paymentStatus', '==', 'pending'));
    const unsubCartelas = onSnapshot(qCartelas, (snapshot) => {
      if (!snapshot.empty) {
        setPendingCartela({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Cartela);
      } else {
        setPendingCartela(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cartelas (pending)');
    });

    return () => {
      unsubApproved();
      unsubGames();
      unsubBets();
      unsubCartelas();
    };
  }, [userId]);

  useEffect(() => {
    if (onHitsUpdate && games.length > 0) {
      const hits = games.reduce((acc, game) => {
        const bet = bets[game.id];
        if (bet && game.result !== 'pending' && bet.prediction === game.result) {
          return acc + 1;
        }
        return acc;
      }, 0);
      onHitsUpdate(hits);
    }
  }, [games, bets, onHitsUpdate]);

  const isLocked = userProfile?.betsSubmitted || 
    (!data.isOverrideClosed && (
      data.isBettingClosed
    )) || !!pendingCartela;

  const handleSelectPrediction = (gameId: string, prediction: Bet['prediction']) => {
    if (isLocked) return;
    setLocalBets(prev => ({ ...prev, [gameId]: prediction }));
  };

  const handleOpenPix = () => {
    if (Object.keys(localBets).length === 0) return;
    const total = quantity * PRICE_PER_TICKET;
    const payload = generatePixPayload(PIX_KEY, total);
    setPixPayload(payload);
    setIsReviewing(false);
    setShowPixModal(true);
  };

  const handleConfirmPayment = async () => {
    setIsSaving(true);
    try {
      const totalAmount = quantity * PRICE_PER_TICKET;
      const cartelaData = {
        userId,
        userName: userProfile?.displayName || 'Usuário',
        predictions: localBets,
        paymentStatus: 'pending',
        timestamp: new Date().toISOString(),
        quantity,
        totalAmount
      };
      
      await addDoc(collection(db, 'cartelas'), cartelaData);
      await updateDoc(doc(db, 'users', userId), { betsSubmitted: true, paymentStatus: 'pending' });
      
      const message = `Olá! Fiz o pagamento de R$ ${totalAmount.toFixed(2)} referente a ${quantity} cartela(s) no Bolão FC. Segue o comprovante.`;
      const whatsappNumber = (data.wn || '5561993642412').replace(/\D/g, '');
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      
      setShowPixModal(false);
      setIsConfirming(false);
    } catch (error) {
      console.error('Error saving cartela:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixPayload);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleSaveBets = async () => {
    if (isLocked || Object.keys(localBets).length === 0) return;
    setIsSaving(true);
    try {
      const savePromises = Object.entries(localBets).map(([gameId, prediction]) => {
        const betId = `${userId}_${gameId}`;
        return setDoc(doc(db, 'bets', betId), {
          userId,
          gameId,
          prediction,
          timestamp: new Date().toISOString()
        });
      });
      await Promise.all(savePromises);
      await updateDoc(doc(db, 'users', userId), { betsSubmitted: true });
      setIsConfirming(false);
    } catch (error) {
      console.error('Error saving bets:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-white-primary/40">Carregando jogos...</div>;

  const filteredGames = filter === 'all' ? games : games.filter(g => bets[g.id]);

  const totalCollected = approvedCartelas.reduce((acc, c) => acc + (c.totalAmount || 0), 0);
  const estimatedPrize = totalCollected * 0.7; // 70% do arrecadado
  const totalParticipants = approvedCartelas.length;

  return (
    <div className="space-y-8">
      {/* Painel de Transparência do Prêmio */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-green-primary/20 to-green-primary/5 border border-green-primary/20 rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(0,200,83,0.1)]"
        >
          <Trophy className="text-green-primary mb-2 shrink-0" size={24} />
          <p className="text-[0.55rem] md:text-[0.6rem] font-bold text-green-primary uppercase tracking-widest mb-1">Prêmio Estimado</p>
          <h4 className="font-bebas text-2xl md:text-4xl text-white-primary">R$ {estimatedPrize.toFixed(2)}</h4>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center text-center"
        >
          <User className="text-white-primary/40 mb-2 shrink-0" size={20} />
          <p className="text-[0.55rem] md:text-[0.6rem] font-bold text-white-primary/40 uppercase tracking-widest mb-1">Participantes</p>
          <h4 className="font-bebas text-2xl md:text-3xl text-white-primary">{totalParticipants}</h4>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 md:col-span-1 bg-zinc-900/50 border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col items-center justify-center text-center"
        >
          <DollarSign className="text-white-primary/40 mb-2 shrink-0" size={20} />
          <p className="text-[0.55rem] md:text-[0.6rem] font-bold text-white-primary/40 uppercase tracking-widest mb-1">Arrecadação Bruta</p>
          <h4 className="font-bebas text-2xl md:text-3xl text-white-primary">R$ {totalCollected.toFixed(2)}</h4>
        </motion.div>
      </div>

      {pendingCartela && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-primary/10 border border-yellow-primary/30 rounded-2xl p-6 text-center"
        >
          <div className="w-12 h-12 bg-yellow-primary/20 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⏳</div>
          <h4 className="font-bebas text-2xl text-yellow-primary mb-2">Aguardando confirmação da equipe!</h4>
          <p className="text-white-primary/60 text-sm">
            Seus palpites foram enviados. Assim que confirmarmos seu pagamento, sua cartela será liberada.
          </p>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-green-primary/10 rounded-full flex items-center justify-center text-2xl">⚽</div>
          <div>
            <h3 className="font-bebas text-xl text-white-primary/80">Bolão FC — Rodada Atual</h3>
            <p className="text-[0.65rem] text-white-primary/40 uppercase tracking-widest font-bold">
              {isLocked ? (pendingCartela ? 'Aguardando Aprovação' : 'Apostas Encerradas') : 'Faça seus palpites abaixo'}
            </p>
          </div>
        </div>

        <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 shrink-0">
          <button 
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white/10 text-white' : 'text-white-primary/30 hover:text-white-primary/60'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('my-bets')}
            className={`px-6 py-2 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all ${filter === 'my-bets' ? 'bg-white/10 text-white' : 'text-white-primary/30 hover:text-white-primary/60'}`}
          >
            Meus Palpites
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {games.length === 0 || (data.isBettingClosed && data.nextRoundTitle) ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900/50 border border-white/10 rounded-[32px] p-12 text-center space-y-6"
          >
            <div className="w-24 h-24 bg-yellow-primary/10 rounded-full flex items-center justify-center mx-auto text-yellow-primary mb-4">
              <Calendar size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bebas text-5xl text-white">
                {data.isBettingClosed && data.nextRoundTitle ? 'RODADA AGENDADA' : 'AGUARDE A PRÓXIMA RODADA'}
              </h3>
              <p className="text-white-primary/40 text-lg max-w-md mx-auto">
                {data.isBettingClosed && data.nextRoundTitle 
                  ? 'A próxima rodada já está agendada. Fique atento para a abertura das apostas!'
                  : 'Estamos preparando os próximos jogos para você palpitar. Fique de olho na nossa comunidade!'}
              </p>
            </div>
            
            {(data.nextRoundTitle || data.nextRoundDate) && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-sm mx-auto space-y-3">
                {data.nextRoundTitle && (
                  <p className="font-bebas text-2xl text-yellow-primary uppercase tracking-wider">{data.nextRoundTitle}</p>
                )}
                <div className="flex items-center justify-center gap-4 text-white-primary/60">
                  {data.nextRoundDate && (
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-green-primary" />
                      <span className="font-bold">{new Date(data.nextRoundDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {data.nextRoundTime && (
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-green-primary" />
                      <span className="font-bold">{data.nextRoundTime}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          filteredGames.map((game) => {
            const bet = bets[game.id];
            const isCorrect = bet && game.result !== 'pending' && bet.prediction === game.result;
            const isWrong = bet && game.result !== 'pending' && bet.prediction !== game.result;
            const currentPrediction = localBets[game.id];

            return (
              <motion.div 
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
              >
                <div className="p-4 md:p-6">
                  {/* Cabeçalho do Jogo: Times e Logos */}
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                      <div className="w-14 h-14 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center p-2 border border-white/5">
                        {game.logo1 && (
                          <img 
                            src={game.logo1} 
                            alt="" 
                            className="max-w-full max-h-full object-contain" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                            }}
                          />
                        )}
                      </div>
                      <span className="font-bebas text-base md:text-xl tracking-wide uppercase truncate w-full text-center text-white-primary/80">{game.team1}</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        <span className="text-white/20 font-black italic text-sm md:text-base">VS</span>
                      </div>
                      <div className="text-[0.6rem] text-white-primary/30 font-mono mt-1">
                        {game.time || (game.date ? new Date(game.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--')}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                      <div className="w-14 h-14 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center p-2 border border-white/5">
                        {game.logo2 && (
                          <img 
                            src={game.logo2} 
                            alt="" 
                            className="max-w-full max-h-full object-contain" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                            }}
                          />
                        )}
                      </div>
                      <span className="font-bebas text-base md:text-xl tracking-wide uppercase truncate w-full text-center text-white-primary/80">{game.team2}</span>
                    </div>
                  </div>

                  {/* Botões de Palpite */}
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <button 
                      onClick={() => handleSelectPrediction(game.id, 'win1')}
                      disabled={game.result !== 'pending' || isLocked}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${currentPrediction === 'win1' ? 'bg-green-primary border-green-primary text-black shadow-[0_0_20px_rgba(0,200,83,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-green-primary/30'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-[0.6rem] font-bold uppercase mb-1 opacity-60">Casa</span>
                      <span className="font-black text-lg">{currentPrediction === 'win1' ? 'X' : '1'}</span>
                    </button>

                    <button 
                      onClick={() => handleSelectPrediction(game.id, 'draw')}
                      disabled={game.result !== 'pending' || isLocked}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${currentPrediction === 'draw' ? 'bg-yellow-primary border-yellow-primary text-black shadow-[0_0_20px_rgba(255,214,0,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-yellow-primary/30'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-[0.6rem] font-bold uppercase mb-1 opacity-60">Empate</span>
                      <span className="font-black text-lg">{currentPrediction === 'draw' ? 'X' : 'X'}</span>
                    </button>

                    <button 
                      onClick={() => handleSelectPrediction(game.id, 'win2')}
                      disabled={game.result !== 'pending' || isLocked}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all ${currentPrediction === 'win2' ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:border-red-500/30'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-[0.6rem] font-bold uppercase mb-1 opacity-60">Fora</span>
                      <span className="font-black text-lg">{currentPrediction === 'win2' ? 'X' : '2'}</span>
                    </button>
                  </div>

                  {/* Footer do Card */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[0.65rem] font-bold text-white-primary/20 uppercase tracking-widest">
                      {game.date ? new Date(game.date + 'T00:00:00').toLocaleDateString('pt-BR') : '--/--/----'}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {game.result !== 'pending' ? (
                        <div className="flex items-center gap-2">
                          {isCorrect && <span className="text-green-primary flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-widest"><Trophy size={12} /> Acertou!</span>}
                          {isWrong && <span className="text-red-400 flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-widest"><AlertCircle size={12} /> Errou</span>}
                        </div>
                      ) : (
                        <div className={`text-[0.65rem] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isLocked ? 'text-white-primary/20' : 'text-green-primary'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-white/20' : 'bg-green-primary animate-pulse'}`} />
                          {isLocked ? 'Encerrado' : 'Aberto'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {!isLocked && Object.keys(localBets).length > 0 && !userProfile?.betsSubmitted && (
        <div className="flex flex-col items-center gap-6 pt-8">
          <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
            <span className="text-xs font-bold uppercase tracking-widest text-white-primary/40">Quantidade de Cartelas:</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold"
              >-</button>
              <span className="font-bebas text-xl w-8 text-center">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold"
              >+</button>
            </div>
            <div className="ml-4 pl-4 border-l border-white/10">
              <span className="text-xs text-white-primary/40 block">Total:</span>
              <span className="text-green-primary font-bebas text-xl">R$ {(quantity * PRICE_PER_TICKET).toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={() => setIsReviewing(true)}
            className="bg-green-primary text-black font-black px-12 py-4 rounded-2xl flex items-center gap-3 hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,200,83,0.3)] group"
          >
            <CreditCard size={20} className="group-hover:rotate-12 transition-transform" /> REVISAR E PAGAR
          </button>
        </div>
      )}

      {/* Modal de Revisão */}
      <AnimatePresence>
        {isReviewing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#111418] border border-white/10 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bebas text-3xl text-white tracking-wider">Revisar Palpites</h3>
                <button 
                  onClick={() => setIsReviewing(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/20 hover:text-white"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-hide mb-6">
                {games.map((game) => {
                  const prediction = localBets[game.id];
                  if (!prediction) return null;
                  return (
                    <div key={game.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <img src={game.logo1} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <span className="font-bebas text-sm uppercase truncate text-white/60">{game.team1}</span>
                        <span className="text-white/10 font-black italic text-xs">VS</span>
                        <span className="font-bebas text-sm uppercase truncate text-white/60">{game.team2}</span>
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <img src={game.logo2} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <div className={`px-4 py-1 rounded-lg font-black text-xs uppercase tracking-widest ${
                        prediction === 'win1' ? 'bg-green-primary text-black' :
                        prediction === 'draw' ? 'bg-yellow-primary text-black' :
                        'bg-red-500 text-white'
                      }`}>
                        {prediction === 'win1' ? 'Casa' : prediction === 'draw' ? 'Empate' : 'Fora'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-yellow-primary/10 border border-yellow-primary/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="text-yellow-primary shrink-0" size={20} />
                <p className="text-xs text-white-primary/60 leading-relaxed">
                  <strong className="text-white">Atenção:</strong> Após o pagamento, seus palpites serão bloqueados e não poderão ser alterados. Revise cuidadosamente antes de prosseguir.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setIsReviewing(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} /> REFAZER PALPITES
                </button>
                <button 
                  onClick={handleOpenPix}
                  className="flex-1 py-4 bg-green-primary text-black font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(0,200,83,0.2)] flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} /> CONFIRMAR E PAGAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pix Modal */}
      <AnimatePresence>
        {showPixModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#111418] border border-white/10 rounded-3xl p-8 w-full max-w-md text-center relative"
            >
              <button 
                onClick={() => setShowPixModal(false)}
                className="absolute top-4 right-4 text-white-primary/20 hover:text-white"
              >✕</button>

              <div className="w-16 h-16 bg-green-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode className="text-green-primary" size={32} />
              </div>

              <h3 className="font-bebas text-3xl mb-2">Pagamento via Pix</h3>
              <p className="text-white-primary/40 text-sm mb-8">
                Escaneie o QR Code ou copie o código abaixo para pagar <br />
                <span className="text-white font-bold">R$ {(quantity * PRICE_PER_TICKET).toFixed(2)}</span>
              </p>

              <div className="bg-white p-4 rounded-2xl inline-block mb-8 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                <QRCodeSVG value={pixPayload} size={200} />
              </div>

              <div className="space-y-4">
                <button 
                  onClick={copyToClipboard}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-3 group"
                >
                  {isCopying ? (
                    <><Check size={18} className="text-green-primary" /> COPIADO!</>
                  ) : (
                    <><Copy size={18} className="text-white-primary/40 group-hover:text-white" /> COPIAR CÓDIGO PIX</>
                  )}
                </button>

                <button 
                  onClick={handleConfirmPayment}
                  disabled={isSaving}
                  className="w-full py-4 bg-green-primary text-black font-black rounded-2xl transition-all shadow-[0_0_20px_rgba(0,200,83,0.2)] flex items-center justify-center gap-3"
                >
                  {isSaving ? 'PROCESSANDO...' : <><ExternalLink size={18} /> JÁ FIZ O PAGAMENTO</>}
                </button>
              </div>

              <p className="mt-6 text-[0.65rem] text-white-primary/20 uppercase tracking-widest font-bold">
                Após pagar, você será redirecionado para o WhatsApp para enviar o comprovante.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {userProfile?.betsSubmitted && !pendingCartela && (
        <div className="bg-green-primary/5 border border-green-primary/20 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-green-primary/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
          <h4 className="font-bebas text-2xl text-green-primary mb-2">Palpites salvos com sucesso!</h4>
          <p className="text-white-primary/40 text-sm leading-relaxed">
            Sua tabela foi enviada e está bloqueada para alterações. <br />
            Boa sorte no bolão! 🚀
          </p>
        </div>
      )}

      {isLocked && !userProfile?.betsSubmitted && !pendingCartela && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⏳</div>
          <h4 className="font-bebas text-2xl text-yellow-400 mb-2">AGUARDE A PRÓXIMA RODADA</h4>
          <p className="text-white-primary/40 text-sm leading-relaxed">
            As apostas para esta rodada foram encerradas pelo administrador. <br />
            Fique atento para a abertura da próxima rodada!
          </p>
          {userProfile?.role === 'admin' && (
            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 text-left">
              <p className="text-[0.6rem] font-bold text-yellow-primary uppercase tracking-widest mb-2">Status do Admin:</p>
              <ul className="text-xs text-white-primary/60 space-y-1 list-disc ml-4">
                {data.isBettingClosed && <li>Bloqueio manual ativado no painel.</li>}
                {data.isOverrideClosed && <li className="text-green-primary font-bold">SOBREPOSIÇÃO ATIVA: Apostas liberadas pelo administrador.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
            >
              <div className="flex items-center gap-4 text-yellow-primary">
                <div className="w-12 h-12 rounded-full bg-yellow-primary/20 flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <h4 className="font-bebas text-2xl uppercase tracking-wider">Confirmar Palpites?</h4>
              </div>
              
              <p className="text-white-primary/60 text-sm leading-relaxed">
                Você tem certeza que deseja salvar estes palpites? <br /><br />
                <strong className="text-white">Uma vez salvos, você NÃO poderá alterá-los.</strong> Somente o administrador poderá resetar sua tabela se necessário.
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsConfirming(false)}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Revisar
                </button>
                <button 
                  onClick={handleSaveBets}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-green-primary text-black font-black rounded-xl hover:bg-green-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
