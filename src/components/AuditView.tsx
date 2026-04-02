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
    className={`bg-white rounded-sm shadow-2xl overflow-hidden flex flex-col border-2 border-black transition-all ${!isZoomed ? 'cursor-zoom-in hover:scale-[1.02]' : 'w-full max-w-2xl'}`}
  >
    {/* Header with Soccer Balls */}
    <div className={`bg-white p-4 text-center border-b-4 border-black ${isZoomed ? 'py-10' : 'py-4'}`}>
      <div className="flex items-center justify-center gap-2">
        <h4 className={`font-black text-black tracking-tighter uppercase flex items-center gap-2 ${isZoomed ? 'text-6xl' : 'text-2xl'}`}>
          BOL<span>⚽</span>O FC
        </h4>
      </div>
      <div className={`flex items-center justify-center gap-4 text-black font-black mt-2 ${isZoomed ? 'text-xl' : 'text-[0.6rem]'}`}>
        <span className="border-2 border-black px-2 py-0.5">RODADA: {new Date().toLocaleDateString('pt-BR')}</span>
        <span className="bg-black text-white px-2 py-0.5">FOLHA Nº {idx + 1}</span>
      </div>
    </div>

    {/* Table Body */}
    <div className={`p-0 flex-1 ${isZoomed ? 'p-4' : ''}`}>
      <table className="w-full border-collapse">
        <tbody>
          {games.map(game => {
            const bet = sheet.bets.find(b => b.gameId === game.id);
            return (
              <tr key={game.id} className="border-b-2 border-black">
                {/* Win 1 Box */}
                <td className={`border-r-2 border-black text-center font-black text-black ${isZoomed ? 'w-16 text-4xl' : 'w-6 text-sm'}`}>
                  {bet?.prediction === 'win1' ? 'X' : ''}
                </td>
                {/* Team 1 */}
                <td className={`px-2 py-1 font-black text-black uppercase truncate text-right border-r-2 border-black ${isZoomed ? 'text-xl' : 'text-[0.65rem]'}`}>
                  <div className="flex flex-col items-end">
                    <span>{game.team1}</span>
                    {game.time && <span className="text-[0.45rem] opacity-40 leading-none">{game.time}</span>}
                  </div>
                </td>
                {/* Draw Box */}
                <td className={`text-center font-black text-black border-r-2 border-black ${isZoomed ? 'w-16 text-4xl' : 'w-6 text-sm'}`}>
                  {bet?.prediction === 'draw' ? 'X' : ''}
                </td>
                {/* Team 2 */}
                <td className={`px-2 py-1 font-black text-black uppercase truncate text-left border-r-2 border-black ${isZoomed ? 'text-xl' : 'text-[0.65rem]'}`}>
                  <div className="flex flex-col items-start">
                    <span>{game.team2}</span>
                    {game.time && <span className="text-[0.45rem] opacity-40 leading-none">{game.time}</span>}
                  </div>
                </td>
                {/* Win 2 Box */}
                <td className={`text-center font-black text-black ${isZoomed ? 'w-16 text-4xl' : 'w-6 text-sm'}`}>
                  {bet?.prediction === 'win2' ? 'X' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Footer - User Info */}
    <div className={`bg-white border-t-4 border-black p-4 ${isZoomed ? 'p-8' : 'p-2'}`}>
      <div className="space-y-1">
        <div className={`flex items-center gap-2 font-black text-black uppercase border-b-2 border-black pb-1 ${isZoomed ? 'text-2xl' : 'text-[0.7rem]'}`}>
          NOME: <span className="flex-1">{sheet.user.displayName}</span>
        </div>
        <div className={`flex items-center gap-2 font-black text-black uppercase ${isZoomed ? 'text-2xl' : 'text-[0.7rem]'}`}>
          FONE: <span className="flex-1">{sheet.user.phone || '—'}</span>
        </div>
      </div>
    </div>
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
    }, (error) => {
      console.error('Error loading games in AuditView:', error);
    });

    const unsubBets = onSnapshot(collection(db, 'bets'), (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      // Garantir que não haja duplicatas por ID
      const uniqueBets = Array.from(new Map(betsData.map(b => [b.id, b])).values());
      setAllBets(uniqueBets);
    }, (error) => {
      console.error('Error loading bets in AuditView:', error);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      // Garantir que não haja duplicatas por UID
      const uniqueUsers = Array.from(new Map(usersData.map(u => [u.uid, u])).values());
      setUsers(uniqueUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error loading users in AuditView:', error);
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
