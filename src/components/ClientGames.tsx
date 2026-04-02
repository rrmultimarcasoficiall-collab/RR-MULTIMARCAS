import { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, onSnapshot, query, where, updateDoc } from '../firebase';
import { Game, Bet, BolaoData, UserProfile } from '../types';
import { Check, Clock, Trophy, AlertCircle, Save, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch games
    const unsubGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      // Garantir que não haja duplicatas por ID
      const uniqueGames = Array.from(new Map(gamesData.map(g => [g.id, g])).values());
      setGames(uniqueGames.sort((a, b) => a.order - b.order));
      setLoading(false);
    }, (error) => {
      console.error('Error loading games in ClientGames:', error);
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
      console.error('Error loading bets in ClientGames:', error);
    });

    return () => {
      unsubGames();
      unsubBets();
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

  const earliestGame = games.length > 0 
    ? [...games].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    : null;

  const isAutoClosed = earliestGame 
    ? new Date() > new Date(new Date(earliestGame.date).getTime() - 15 * 60 * 1000)
    : false;

  const isLocked = userProfile?.betsSubmitted || (data.deadline && new Date() > new Date(data.deadline)) || data.isBettingClosed || isAutoClosed;

  const handleSelectPrediction = (gameId: string, prediction: Bet['prediction']) => {
    if (isLocked) return;
    setLocalBets(prev => ({ ...prev, [gameId]: prediction }));
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-green-primary/10 rounded-full flex items-center justify-center text-2xl">⚽</div>
          <div>
            <h3 className="font-bebas text-xl text-white-primary/80">Bolão FC — Rodada Atual</h3>
            <p className="text-[0.65rem] text-white-primary/40 uppercase tracking-widest font-bold">
              {isLocked ? 'Apostas Encerradas' : 'Faça seus palpites abaixo'}
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
        {filteredGames.map((game) => {
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
              <div className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-6">
                {/* Team 1 */}
                <div className="flex-1 flex items-center justify-end gap-4 w-full">
                  <span className="font-bebas text-xl md:text-2xl tracking-wide uppercase text-right flex-1 truncate">{game.team1}</span>
                  <button 
                    onClick={() => handleSelectPrediction(game.id, 'win1')}
                    disabled={game.result !== 'pending' || isLocked}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center text-xl font-black shrink-0 ${currentPrediction === 'win1' ? 'bg-green-primary border-green-primary text-black scale-110 shadow-[0_0_20px_rgba(0,200,83,0.4)]' : 'border-white/10 hover:border-green-primary/50 text-white/20'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {currentPrediction === 'win1' ? 'X' : ''}
                  </button>
                </div>

                {/* Draw */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="text-[0.6rem] font-bold text-white-primary/20 uppercase tracking-tighter">Empate</div>
                  <button 
                    onClick={() => handleSelectPrediction(game.id, 'draw')}
                    disabled={game.result !== 'pending' || isLocked}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center text-xl font-black ${currentPrediction === 'draw' ? 'bg-yellow-primary border-yellow-primary text-black scale-110 shadow-[0_0_20px_rgba(255,214,0,0.4)]' : 'border-white/10 hover:border-yellow-primary/50 text-white/20'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {currentPrediction === 'draw' ? 'X' : ''}
                  </button>
                  <div className="text-[0.55rem] text-white-primary/30 font-mono mt-1">
                    {game.time || (game.date ? new Date(game.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--')}
                  </div>
                </div>

                {/* Team 2 */}
                <div className="flex-1 flex items-center justify-start gap-4 w-full">
                  <button 
                    onClick={() => handleSelectPrediction(game.id, 'win2')}
                    disabled={game.result !== 'pending' || isLocked}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 transition-all flex items-center justify-center text-xl font-black shrink-0 ${currentPrediction === 'win2' ? 'bg-red-500 border-red-500 text-white scale-110 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'border-white/10 hover:border-red-500/50 text-white/20'} ${(game.result !== 'pending' || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {currentPrediction === 'win2' ? 'X' : ''}
                  </button>
                  <span className="font-bebas text-xl md:text-2xl tracking-wide uppercase text-left flex-1 truncate">{game.team2}</span>
                </div>
              </div>

              {/* Status Bar */}
              <div className="bg-white/2 px-6 py-2 flex items-center justify-between border-t border-white/5">
                <div className="text-[0.6rem] text-white-primary/30 font-bold uppercase tracking-widest">
                  {game.date ? new Date(game.date).toLocaleDateString('pt-BR') : 'Data não definida'}
                </div>
                
                <div className="flex items-center gap-3">
                  {game.result !== 'pending' ? (
                    <div className="flex items-center gap-2">
                      {isCorrect && <span className="text-green-primary flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-widest"><Trophy size={12} /> Acertou!</span>}
                      {isWrong && <span className="text-red-400 flex items-center gap-1 text-[0.6rem] font-black uppercase tracking-widest"><AlertCircle size={12} /> Errou</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/20">
                      <Clock size={10} /> {isLocked ? 'Encerrado' : 'Aberto'}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!isLocked && Object.keys(localBets).length > 0 && !userProfile?.betsSubmitted && (
        <div className="flex justify-center pt-8">
          <button 
            onClick={() => setIsConfirming(true)}
            className="bg-green-primary text-black font-black px-12 py-4 rounded-2xl flex items-center gap-3 hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,200,83,0.3)] group"
          >
            <Save size={20} className="group-hover:rotate-12 transition-transform" /> SALVAR MEUS PALPITES
          </button>
        </div>
      )}

      {userProfile?.betsSubmitted && (
        <div className="bg-green-primary/5 border border-green-primary/20 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-green-primary/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
          <h4 className="font-bebas text-2xl text-green-primary mb-2">Palpites salvos com sucesso!</h4>
          <p className="text-white-primary/40 text-sm leading-relaxed">
            Sua tabela foi enviada e está bloqueada para alterações. <br />
            Boa sorte no bolão! 🚀
          </p>
        </div>
      )}

      {isLocked && !userProfile?.betsSubmitted && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🔒</div>
          <h4 className="font-bebas text-2xl text-red-400 mb-2">Apostas Encerradas</h4>
          <p className="text-white-primary/40 text-sm leading-relaxed">
            O prazo para esta rodada expirou. <br />
            Fique atento para a próxima rodada!
          </p>
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
