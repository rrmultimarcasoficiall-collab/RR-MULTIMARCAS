import { useState, useEffect } from 'react';
import { db, collection, onSnapshot } from '../firebase';
import { Game, Bet, UserProfile } from '../types';
import { Search, ShieldCheck, Download, User as UserIcon, Calendar, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const BettingSheet = ({ sheet, idx, isZoomed = false, games, onSelect }: { 
  sheet: { user: UserProfile, bets: Bet[] }, 
  idx: number, 
  isZoomed?: boolean, 
  games: Game[],
  onSelect?: () => void,
  key?: string
}) => (
  <div 
    onClick={() => !isZoomed && onSelect?.()}
    className={`bg-[#f0f0f0] rounded-sm shadow-2xl overflow-hidden flex flex-col border-2 border-black/10 transition-all ${!isZoomed ? 'cursor-zoom-in hover:scale-[1.02]' : 'w-full max-w-2xl'}`}
  >
    {/* Sheet Header */}
    <div className={`bg-white border-b-2 border-black/5 p-3 text-center ${isZoomed ? 'py-6' : ''}`}>
      <h4 className={`font-black text-black tracking-tighter uppercase ${isZoomed ? 'text-3xl' : 'text-sm'}`}>BOLÃO FC</h4>
      <div className={`flex items-center justify-center gap-2 text-black/60 font-bold ${isZoomed ? 'text-base mt-2' : 'text-[0.6rem]'}`}>
        <Calendar size={isZoomed ? 16 : 10} /> RODADA DO DIA {new Date().toLocaleDateString('pt-BR')}
        <span className="bg-black text-white px-1 rounded">FOLHA Nº {idx + 1}</span>
      </div>
    </div>

    {/* Sheet Body - Games Table */}
    <div className={`p-2 flex-1 ${isZoomed ? 'p-6' : ''}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/20">
            <th className={`text-left py-1 text-black/40 uppercase font-bold ${isZoomed ? 'text-sm' : 'text-[0.55rem]'}`}>Jogo</th>
            <th className={`text-center text-black/40 uppercase font-bold ${isZoomed ? 'text-xs px-4' : 'text-[0.45rem] w-8'}`}>Vitória</th>
            <th className={`text-center text-black/40 uppercase font-bold ${isZoomed ? 'text-xs px-4' : 'text-[0.45rem] w-8'}`}>Empate</th>
            <th className={`text-center text-black/40 uppercase font-bold ${isZoomed ? 'text-xs px-4' : 'text-[0.45rem] w-8'}`}>Derrota</th>
          </tr>
        </thead>
        <tbody>
          {games.map(game => {
            const bet = sheet.bets.find(b => b.gameId === game.id);
            return (
              <tr key={game.id} className="border-b border-black/5">
                <td className="py-1 pr-2">
                  <div className="flex flex-col">
                    <span className={`font-black text-black leading-none uppercase truncate ${isZoomed ? 'text-lg' : 'text-[0.6rem] max-w-[80px]'}`}>{game.team1}</span>
                    <span className={`${isZoomed ? 'text-xs' : 'text-[0.45rem]'} text-black/40 leading-none`}>vs {game.team2}</span>
                  </div>
                </td>
                <td className={`text-center font-black text-black ${isZoomed ? 'text-2xl' : 'text-xs'}`}>
                  {bet?.prediction === 'win1' ? 'X' : ''}
                </td>
                <td className={`text-center font-black text-black ${isZoomed ? 'text-2xl' : 'text-xs'}`}>
                  {bet?.prediction === 'draw' ? 'X' : ''}
                </td>
                <td className={`text-center font-black text-black ${isZoomed ? 'text-2xl' : 'text-xs'}`}>
                  {bet?.prediction === 'win2' ? 'X' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Sheet Footer - User Info */}
    <div className={`bg-white border-t-2 border-black/5 p-2 mt-auto ${isZoomed ? 'p-6' : ''}`}>
      <div className="flex flex-col gap-0.5">
        <div className={`flex items-center gap-1 font-black text-black uppercase ${isZoomed ? 'text-xl' : 'text-[0.55rem]'}`}>
          <UserIcon size={isZoomed ? 20 : 10} /> NOME: {sheet.user.displayName}
        </div>
        <div className={`${isZoomed ? 'text-sm' : 'text-[0.5rem]'} text-black/60 font-mono`}>
          ID: {sheet.user.uid.substring(0, 12)}...
        </div>
      </div>
    </div>
    {!isZoomed && (
      <div className="absolute top-2 right-2 bg-black/5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 size={12} className="text-black/40" />
      </div>
    )}
  </div>
);

export default function AuditView() {
  const [games, setGames] = useState<Game[]>([]);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<{ user: UserProfile, bets: Bet[], idx: number } | null>(null);

  useEffect(() => {
    const unsubGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      // Garantir que não haja duplicatas por ID
      const uniqueGames = Array.from(new Map(gamesData.map(g => [g.id, g])).values());
      setGames(uniqueGames.sort((a, b) => a.order - b.order));
    });

    const unsubBets = onSnapshot(collection(db, 'bets'), (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      // Garantir que não haja duplicatas por ID
      const uniqueBets = Array.from(new Map(betsData.map(b => [b.id, b])).values());
      setAllBets(uniqueBets);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Garantir que não haja duplicatas por UID
      const uniqueUsers = Array.from(new Map(usersData.map(u => [u.uid, u])).values());
      setUsers(uniqueUsers);
      setLoading(false);
    });

    return () => {
      unsubGames();
      unsubBets();
      unsubUsers();
    };
  }, []);

  // Group bets by user
  const userSheets = users.map(user => {
    const userBets = allBets.filter(bet => bet.userId === user.uid);
    if (userBets.length === 0) return null;
    return {
      user,
      bets: userBets
    };
  }).filter(Boolean) as { user: UserProfile, bets: Bet[] }[];

  const filteredSheets = userSheets.filter(sheet => 
    sheet.user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sheet.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-white-primary/40">Carregando auditoria...</div>;

  const totalSheets = userSheets.length;
  const pages = Math.ceil(totalSheets / 12);

  return (
    <div className="space-y-8">
      {/* Audit Summary Header */}
      <div className="bg-gradient-to-br from-[#111b21] to-[#202c33] border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <ShieldCheck className="text-green-primary" size={24} />
          <h3 className="font-bebas text-2xl text-white">Mapa das Cartelas - Auditoria Pública</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/40 mb-1">Total de Cartelas</p>
            <p className="text-2xl font-mono text-green-primary">{totalSheets}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/40 mb-1">Páginas de Auditoria</p>
            <p className="text-2xl font-mono text-white">{pages}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/40 mb-1">Status</p>
              <p className="text-sm font-bold text-green-primary flex items-center gap-1">
                <ShieldCheck size={14} /> Verificado
              </p>
            </div>
            <button className="p-2 bg-green-primary/10 text-green-primary rounded-lg hover:bg-green-primary/20 transition-all">
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nome do apostador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 outline-none focus:border-green-primary transition-all text-sm"
        />
      </div>

      {/* Visual Sheets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredSheets.map((sheet, idx) => (
          <BettingSheet 
            key={`${sheet.user.uid}-${idx}`} 
            sheet={sheet} 
            idx={idx} 
            games={games}
            onSelect={() => setSelectedSheet({ ...sheet, idx })}
          />
        ))}
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {selectedSheet && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedSheet(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedSheet(null)}
                className="absolute -top-12 right-0 text-white hover:text-green-primary transition-colors flex items-center gap-2 font-bold uppercase tracking-widest text-xs"
              >
                Fechar <X size={20} />
              </button>
              <BettingSheet 
                sheet={selectedSheet} 
                idx={selectedSheet.idx} 
                isZoomed 
                games={games}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredSheets.length === 0 && (
        <div className="text-center py-24 bg-white/2 rounded-3xl border border-dashed border-white/10">
          <p className="text-white-primary/20 italic">Nenhuma cartela encontrada para esta busca.</p>
        </div>
      )}
    </div>
  );
}
