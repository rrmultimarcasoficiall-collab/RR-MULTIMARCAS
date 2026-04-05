import React, { useState, useEffect, useRef, type RefObject } from 'react';
import { db, collection, onSnapshot, doc } from '../firebase';
import { Game, Bet, UserProfile, BolaoData } from '../types';
import { Search, ShieldCheck, Download, User as UserIcon, Calendar, Maximize2, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';

const BettingSheet = ({ sheet, idx, isZoomed = false, games, onSelect, isAdmin, sheetRef }: { 
  sheet: { user: UserProfile, bets: Bet[] }, 
  idx: number, 
  isZoomed?: boolean, 
  games: Game[],
  onSelect?: () => void,
  isAdmin?: boolean,
  sheetRef?: RefObject<HTMLDivElement | null>
}) => {
  const maskPhone = (phone: string) => {
    if (!phone) return '—';
    if (isAdmin) return phone;
    // Mask middle digits: (11) 9****-1234
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return '***-****';
    return phone.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2****-$4');
  };

  return (
    <div 
      ref={sheetRef}
      onClick={() => !isZoomed && onSelect?.()}
      className={`bg-white rounded-sm shadow-2xl overflow-hidden flex flex-col border-2 border-black transition-all relative ${!isZoomed ? 'cursor-zoom-in hover:scale-[1.02]' : 'w-full max-w-2xl'}`}
    >
      {/* Watermark */}
      {isZoomed && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] rotate-[-35deg] select-none z-0">
          <div className="text-black font-black text-9xl whitespace-nowrap">
            AUTÊNTICO BOLÃO FC
          </div>
        </div>
      )}

      {/* Header with Soccer Balls */}
      <div className={`bg-white p-4 text-center border-b-4 border-black relative z-10 ${isZoomed ? 'py-10' : 'py-4'}`}>
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
      <div className={`p-0 flex-1 relative z-10 ${isZoomed ? 'p-4' : ''}`}>
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
                      <div className="flex items-center gap-2 justify-end w-full">
                        <span>{game.team1}</span>
                        {game.logo1 && <img src={game.logo1} alt="" className={`${isZoomed ? 'w-8 h-8' : 'w-4 h-4'} object-contain`} referrerPolicy="no-referrer" />}
                      </div>
                      {game.time && <span className="text-[0.45rem] opacity-40 leading-none">{game.time}</span>}
                    </div>
                  </td>
                  {/* Draw Box */}
                  <td className={`text-center font-black text-black border-r-2 border-black ${isZoomed ? 'w-16 text-4xl' : 'text-sm'}`}>
                    {bet?.prediction === 'draw' ? 'X' : ''}
                  </td>
                  {/* Team 2 */}
                  <td className={`px-2 py-1 font-black text-black uppercase truncate text-left border-r-2 border-black ${isZoomed ? 'text-xl' : 'text-[0.65rem]'}`}>
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 justify-start w-full">
                        {game.logo2 && <img src={game.logo2} alt="" className={`${isZoomed ? 'w-8 h-8' : 'w-4 h-4'} object-contain`} referrerPolicy="no-referrer" />}
                        <span>{game.team2}</span>
                      </div>
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
      <div className={`bg-white border-t-4 border-black p-4 relative z-10 ${isZoomed ? 'p-8' : 'p-2'}`}>
        <div className="space-y-1">
          <div className={`flex items-center gap-2 font-black text-black uppercase border-b-2 border-black pb-1 ${isZoomed ? 'text-2xl' : 'text-[0.7rem]'}`}>
            NOME: <span className="flex-1">{sheet.user.displayName}</span>
          </div>
          <div className={`flex items-center gap-2 font-black text-black uppercase ${isZoomed ? 'text-2xl' : 'text-[0.7rem]'}`}>
            FONE: <span className="flex-1">{maskPhone(sheet.user.phone || '')}</span>
          </div>
        </div>
        {isZoomed && (
          <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between opacity-40">
            <div className="flex items-center gap-2 text-xs font-black uppercase">
              <CheckCircle size={14} /> Autenticidade Garantida
            </div>
            <div className="text-[0.6rem] font-mono">
              ID: {sheet.user.uid.substring(0, 8).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function AuditView({ currentUser }: { currentUser: UserProfile | null }) {
  const [games, setGames] = useState<Game[]>([]);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<{ user: UserProfile, bets: Bet[], idx: number } | null>(null);
  const [config, setConfig] = useState<BolaoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  const downloadSheet = async () => {
    if (!sheetRef.current || !selectedSheet) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `cartela-${selectedSheet.user.displayName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error('Error downloading sheet:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    // 1. Load config first to check if audit is actually open
    const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BolaoData;
        setConfig(data);
        
        // Only start other listeners if audit is ready or deadline passed
        const isDeadlinePassed = data.deadline && new Date() > new Date(data.deadline.includes('T') ? data.deadline + ":00Z" : data.deadline);
        const isAuditOpen = data.isAuditReady || isDeadlinePassed;

        if (isAuditOpen) {
          setError(null);
        } else {
          setError('A auditoria ainda não está disponível. Aguarde o encerramento das apostas.');
          setLoading(false);
        }
      }
    });

    return () => unsubConfig();
  }, []);

  useEffect(() => {
    if (!config) return;

    const isDeadlinePassed = config.deadline && new Date() > new Date(config.deadline.includes('T') ? config.deadline + ":00Z" : config.deadline);
    const isAuditOpen = config.isAuditReady || isDeadlinePassed;

    if (!isAuditOpen) return;

    const unsubGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setGames(gamesData.sort((a, b) => a.order - b.order));
    }, (err) => {
      console.error('Error loading games in AuditView:', err);
    });

    const unsubBets = onSnapshot(collection(db, 'bets'), (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bet));
      setAllBets(betsData);
    }, (err) => {
      console.error('Error loading bets in AuditView:', err);
      if (err.message.includes('permissions')) {
        setError('Você não tem permissão para ver as apostas ainda.');
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error('Error loading users in AuditView:', err);
      setLoading(false);
      if (err.message.includes('permissions')) {
        setError('Você não tem permissão para ver os usuários ainda.');
      }
    });

    return () => {
      unsubGames();
      unsubBets();
      unsubUsers();
    };
  }, [config]);

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

  if (error) {
    return (
      <div className="text-center py-24 bg-white/5 rounded-3xl border border-white/10 space-y-4">
        <ShieldCheck className="mx-auto text-yellow-primary/40" size={48} />
        <p className="text-white-primary/60 font-medium">{error}</p>
      </div>
    );
  }

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
          <div key={`${sheet.user.uid}-${idx}`}>
            <BettingSheet 
              sheet={sheet} 
              idx={idx} 
              games={games}
              onSelect={() => setSelectedSheet({ ...sheet, idx })}
              isAdmin={isAdmin}
            />
          </div>
        ))}
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {selectedSheet && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto"
            onClick={() => setSelectedSheet(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl my-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute -top-12 right-0 flex items-center gap-4">
                <button 
                  onClick={downloadSheet}
                  disabled={isDownloading}
                  className="bg-green-primary text-black px-4 py-2 rounded-lg font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-green-primary/80 transition-all disabled:opacity-50"
                >
                  {isDownloading ? 'Baixando...' : 'Baixar Cartela'} <Download size={18} />
                </button>
                <button 
                  onClick={() => setSelectedSheet(null)}
                  className="text-white hover:text-green-primary transition-colors flex items-center gap-2 font-bold uppercase tracking-widest text-xs"
                >
                  Fechar <X size={20} />
                </button>
              </div>
              <BettingSheet 
                sheet={selectedSheet} 
                idx={selectedSheet.idx} 
                isZoomed 
                games={games}
                isAdmin={isAdmin}
                sheetRef={sheetRef}
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
