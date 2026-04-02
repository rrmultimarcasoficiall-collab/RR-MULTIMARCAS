import { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc } from '../firebase';
import { Game } from '../types';
import { Trash2, Plus, Check, Clock } from 'lucide-react';

export default function AdminGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [newGame, setNewGame] = useState({ team1: '', team2: '', date: '', order: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      // Garantir que não haja duplicatas por ID
      const uniqueGames = Array.from(new Map(gamesData.map(g => [g.id, g])).values());
      setGames(uniqueGames.sort((a, b) => a.order - b.order));
    });
    return () => unsub();
  }, []);

  const addGame = async () => {
    if (!newGame.team1 || !newGame.team2) return;
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'games', id), {
      ...newGame,
      id,
      result: 'pending',
      order: games.length + 1
    });
    setNewGame({ team1: '', team2: '', date: '', order: 0 });
  };

  const updateResult = async (gameId: string, result: Game['result']) => {
    await updateDoc(doc(db, 'games', gameId), { result });
  };

  const removeGame = async (gameId: string) => {
    await deleteDoc(doc(db, 'games', gameId));
  };

  return (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="font-bebas text-xl mb-4 text-white-primary/60">Adicionar Novo Jogo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input 
            type="text" placeholder="Time 1" value={newGame.team1}
            onChange={(e) => setNewGame({...newGame, team1: e.target.value})}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-green-primary"
          />
          <input 
            type="text" placeholder="Time 2" value={newGame.team2}
            onChange={(e) => setNewGame({...newGame, team2: e.target.value})}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-green-primary"
          />
          <input 
            type="datetime-local" value={newGame.date}
            onChange={(e) => setNewGame({...newGame, date: e.target.value})}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-green-primary"
          />
          <button onClick={addGame} className="bg-green-primary text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-dark">
            <Plus size={18} /> Adicionar
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
              <th className="py-4 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
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
                    onClick={() => updateResult(game.id, 'win1')}
                    className={`w-8 h-8 rounded border transition-all ${game.result === 'win1' ? 'bg-green-primary border-green-primary text-white' : 'border-white/10 hover:border-green-primary/50'}`}
                  >
                    {game.result === 'win1' ? 'X' : ''}
                  </button>
                </td>
                <td className="py-4 px-4 text-center">
                  <button 
                    onClick={() => updateResult(game.id, 'draw')}
                    className={`w-8 h-8 rounded border transition-all ${game.result === 'draw' ? 'bg-yellow-primary border-yellow-primary text-black' : 'border-white/10 hover:border-yellow-primary/50'}`}
                  >
                    {game.result === 'draw' ? 'X' : ''}
                  </button>
                </td>
                <td className="py-4 px-4 text-center">
                  <button 
                    onClick={() => updateResult(game.id, 'win2')}
                    className={`w-8 h-8 rounded border transition-all ${game.result === 'win2' ? 'bg-green-primary border-green-primary text-white' : 'border-white/10 hover:border-green-primary/50'}`}
                  >
                    {game.result === 'win2' ? 'X' : ''}
                  </button>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => updateResult(game.id, 'pending')}
                      className={`p-2 rounded hover:bg-white/5 ${game.result === 'pending' ? 'text-yellow-primary' : 'text-white-primary/20'}`}
                      title="Marcar como pendente"
                    >
                      <Clock size={16} />
                    </button>
                    <button onClick={() => removeGame(game.id)} className="p-2 rounded hover:bg-red-500/20 text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
