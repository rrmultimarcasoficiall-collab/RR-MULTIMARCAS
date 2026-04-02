import { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, onSnapshot, query, where } from '../firebase';
import { Game, Bet, BolaoData } from '../types';
import { Check, Clock, Trophy, AlertCircle } from 'lucide-react';

interface ClientGamesProps {
  userId: string;
  onHitsUpdate?: (hits: number) => void;
  data: BolaoData;
}

export default function ClientGames({ userId, onHitsUpdate, data }: ClientGamesProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'my-bets'>('all');

  useEffect(() => {
    // Fetch games
    const unsubGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      // Garantir que não haja duplicatas por ID
      const uniqueGames = Array.from(new Map(gamesData.map(g => [g.id, g])).values());
      setGames(uniqueGames.sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    // Fetch user bets
    const q = query(collection(db, 'bets'), where('userId', '==', userId));
    const unsubBets = onSnapshot(q, (snapshot) => {
      const betsData: Record<string, Bet> = {};
      snapshot.docs.forEach(doc => {
        const bet = { id: doc.id, ...doc.data() } as Bet;
        betsData[bet.gameId] = bet;
      });
      setBets(betsData);
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

  const isDeadlinePassed = data.deadline ? new Date() > new Date(data.deadline) : false;

  const placeBet = async (gameId: string, prediction: Bet['prediction']) => {
    if (isDeadlinePassed) return;
    const betId = `${userId}_${gameId}`;
    await setDoc(doc(db, 'bets', betId), {
      userId,
      gameId,
      prediction,
      timestamp: new Date().toISOString()
    });
  };

  if (loading) return <div className="text-center py-12 text-white-primary/40">Carregando jogos...</div>;

  const filteredGames = filter === 'all' ? games : games.filter(g => bets[g.id]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="bg-green-primary/10 border border-green-primary/20 rounded-2xl p-6 flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-green-primary/20 rounded-full flex items-center justify-center text-2xl">⚽</div>
          <div>
            <h3 className="font-bebas text-xl text-green-primary">Seus Palpites</h3>
            <p className="text-sm text-white-primary/60">Marque o seu "X" para cada jogo da rodada!</p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
          <button 
            onClick={() => setFilter('all')}
            className={`px-6 py-2.5 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
          >
            Todos os Jogos
          </button>
          <button 
            onClick={() => setFilter('my-bets')}
            className={`px-6 py-2.5 rounded-lg text-[0.65rem] font-bold uppercase tracking-widest transition-all ${filter === 'my-bets' ? 'bg-green-primary text-white shadow-lg' : 'text-white-primary/40 hover:text-white-primary/70'}`}
          >
            Meus Palpites
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-[0.65rem] font-bold tracking-widest text-white-primary/40 uppercase">
              <th className="py-4 px-4">Jogo</th>
              <th className="py-4 px-4 text-center">Vitória</th>
              <th className="py-4 px-4 text-center">Empate</th>
              <th className="py-4 px-4 text-center">Derrota</th>
              <th className="py-4 px-4 text-center">Data do Palpite</th>
              <th className="py-4 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredGames.map((game) => {
              const bet = bets[game.id];
              const isCorrect = bet && game.result !== 'pending' && bet.prediction === game.result;
              const isWrong = bet && game.result !== 'pending' && bet.prediction !== game.result;

              return (
                <tr key={game.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{game.team1}</span>
                      <span className="text-white-primary/30 text-xs">vs</span>
                      <span className="font-bold">{game.team2}</span>
                    </div>
                    <div className="text-[0.6rem] text-white-primary/40 mt-1">
                      {game.date ? new Date(game.date).toLocaleString('pt-BR') : 'Data não definida'}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button 
                      onClick={() => placeBet(game.id, 'win1')}
                      disabled={game.result !== 'pending' || isDeadlinePassed}
                      className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center text-lg font-black ${bet?.prediction === 'win1' ? 'bg-green-primary border-green-primary text-white' : 'border-white/10 hover:border-green-primary/50'} ${(game.result !== 'pending' || isDeadlinePassed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {bet?.prediction === 'win1' ? 'X' : ''}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button 
                      onClick={() => placeBet(game.id, 'draw')}
                      disabled={game.result !== 'pending' || isDeadlinePassed}
                      className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center text-lg font-black ${bet?.prediction === 'draw' ? 'bg-yellow-primary border-yellow-primary text-black' : 'border-white/10 hover:border-yellow-primary/50'} ${(game.result !== 'pending' || isDeadlinePassed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {bet?.prediction === 'draw' ? 'X' : ''}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button 
                      onClick={() => placeBet(game.id, 'win2')}
                      disabled={game.result !== 'pending' || isDeadlinePassed}
                      className={`w-10 h-10 rounded-lg border transition-all flex items-center justify-center text-lg font-black ${bet?.prediction === 'win2' ? 'bg-green-primary border-green-primary text-white' : 'border-white/10 hover:border-green-primary/50'} ${(game.result !== 'pending' || isDeadlinePassed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {bet?.prediction === 'win2' ? 'X' : ''}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {bet?.timestamp ? (
                      <div className="text-[0.65rem] text-white-primary/40">
                        {new Date(bet.timestamp).toLocaleString('pt-BR')}
                      </div>
                    ) : (
                      <span className="text-white-primary/10">—</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {game.result === 'pending' ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex justify-end items-center gap-1 text-white-primary/30 text-[0.65rem] font-bold uppercase">
                          <Clock size={12} /> {isDeadlinePassed ? 'Encerrado' : 'Aberto'}
                        </div>
                        {isDeadlinePassed && (
                          <span className="text-[0.55rem] text-red-400/60 uppercase font-bold tracking-tighter">Apostas Bloqueadas</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-end items-center gap-1">
                        {isCorrect && <span className="text-green-primary flex items-center gap-1 text-[0.65rem] font-bold uppercase"><Trophy size={14} /> Acertou!</span>}
                        {isWrong && <span className="text-red-400 flex items-center gap-1 text-[0.65rem] font-bold uppercase"><AlertCircle size={14} /> Errou</span>}
                        {!bet && <span className="text-white-primary/20 text-[0.65rem] font-bold uppercase">Sem palpite</span>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
