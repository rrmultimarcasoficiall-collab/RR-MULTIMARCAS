import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc, writeBatch, query, orderBy } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Game, BolaoData, Team } from '../types';
import { Trash2, Plus, Check, Clock, Calendar, Save, Lock, Unlock, Send, AlertTriangle, X, Search, Sparkles, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

export default function AdminGames() {
  const [activeGames, setActiveGames] = useState<Game[]>([]);
  const [pendingGames, setPendingGames] = useState<Game[]>([]);
  const [newGame, setNewGame] = useState({ team1: '', team2: '', logo1: '', logo2: '', date: '', time: '', order: 0 });
  const [config, setConfig] = useState<BolaoData | null>(null);
  const [nextRound, setNextRound] = useState({ title: '', date: '', time: '' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSearchingLogo, setIsSearchingLogo] = useState<{ team1: boolean, team2: boolean }>({ team1: false, team2: false });
  const [teams, setTeams] = useState<Team[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'success' | 'warning' }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });

  const searchLogo = async (teamName: string, field: 'logo1' | 'logo2') => {
    if (!teamName) return;
    
    const teamKey = field === 'logo1' ? 'team1' : 'team2';
    setIsSearchingLogo(prev => ({ ...prev, [teamKey]: true }));

    try {
      const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY not found in process.env');
        setIsSearchingLogo(prev => ({ ...prev, [teamKey]: false }));
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the official high-quality logo URL (PNG or SVG) for the football team "${teamName}". 
        Return ONLY a valid direct image URL. If you can't find a direct URL, return a placeholder URL from a reliable source like Wikipedia or a sports CDN.
        Do not include any text other than the URL.`,
      });

      const url = response.text?.trim();
      if (url && url.startsWith('http')) {
        setNewGame(prev => ({ ...prev, [field]: url }));
      }
    } catch (error) {
      console.error('Error searching logo:', error);
    } finally {
      setIsSearchingLogo(prev => ({ ...prev, [teamKey]: false }));
    }
  };

  const autoFetchLogo = (teamName: string, field: 'logo1' | 'logo2') => {
    if (!teamName) return;
    const foundTeam = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase().trim());
    if (foundTeam) {
      setNewGame(prev => ({ ...prev, [field]: foundTeam.logo }));
    }
  };

  useEffect(() => {
    const unsubActive = onSnapshot(query(collection(db, 'games'), orderBy('order', 'asc')), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setActiveGames(gamesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
    });

    const unsubDraft = onSnapshot(query(collection(db, 'draftGames'), orderBy('order', 'asc')), (snapshot) => {
      const gamesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      setPendingGames(gamesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'draftGames');
    });

    const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        const cfg = snapshot.data() as BolaoData;
        setConfig(cfg);
        setNextRound({
          title: cfg.nextRoundTitle || '',
          date: cfg.nextRoundDate || '',
          time: cfg.nextRoundTime || ''
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
    });

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    return () => {
      unsubActive();
      unsubDraft();
      unsubConfig();
      unsubTeams();
    };
  }, []);

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'success' | 'warning' = 'warning') => {
    setConfirmModal({ show: true, title, message, onConfirm, type });
  };

  const addGameToPreparation = async () => {
    if (!newGame.team1 || !newGame.team2) return;
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'draftGames', id), {
      ...newGame,
      id,
      result: 'pending',
      order: pendingGames.length + 1
    });
    setNewGame({ team1: '', team2: '', logo1: '', logo2: '', date: '', time: '', order: 0 });
  };

  const updateResult = (gameId: string, result: Game['result']) => {
    showConfirm(
      'Atualizar Resultado?',
      `Confirmar resultado: ${result === 'win1' ? 'Time 1' : result === 'win2' ? 'Time 2' : result === 'draw' ? 'Empate' : 'Pendente'}?`,
      async () => {
        await updateDoc(doc(db, 'games', gameId), { result });
      }
    );
  };

  const removeActiveGame = (gameId: string) => {
    showConfirm(
      'Excluir Jogo Ativo?',
      'Tem certeza que deseja remover este jogo da rodada atual?',
      async () => {
        await deleteDoc(doc(db, 'games', gameId));
      },
      'danger'
    );
  };

  const removePendingGame = (gameId: string) => {
    showConfirm(
      'Excluir Jogo?',
      'Tem certeza que deseja remover este jogo da lista de preparação?',
      async () => {
        await deleteDoc(doc(db, 'draftGames', gameId));
      },
      'danger'
    );
  };

  const toggleBetting = () => {
    if (!config) return;
    const newState = !config.isBettingClosed;
    showConfirm(
      newState ? 'Encerrar Apostas?' : 'Abrir Apostas?',
      newState ? 'Os usuários não poderão mais enviar palpites.' : 'Os usuários poderão enviar palpites novamente.',
      async () => {
        await updateDoc(doc(db, 'config', 'main'), { 
          isBettingClosed: newState 
        });
      }
    );
  };

  const saveNextRound = async () => {
    showConfirm(
      'Agendar Rodada?',
      'As informações da próxima rodada serão atualizadas para os clientes.',
      async () => {
        setIsSavingConfig(true);
        try {
          const deadline = nextRound.date && nextRound.time ? `${nextRound.date}T${nextRound.time}` : '';
          await updateDoc(doc(db, 'config', 'main'), {
            nextRoundTitle: nextRound.title,
            nextRoundDate: nextRound.date,
            nextRoundTime: nextRound.time,
            deadline: deadline
          });
        } catch (e) {
          console.error(e);
        } finally {
          setIsSavingConfig(false);
        }
      }
    );
  };

  const postRound = async () => {
    if (pendingGames.length === 0) {
      showConfirm('Aviso', 'Adicione pelo menos um jogo antes de postar a rodada.', () => {}, 'warning');
      return;
    }

    showConfirm(
      'POSTAR NOVA RODADA?',
      'Isso irá EXCLUIR todos os jogos atuais, limpar as apostas e pagamentos dos usuários, e publicar os novos jogos. Esta ação é IRREVERSÍVEL!',
      async () => {
        setIsSavingConfig(true);
        try {
          const batch = writeBatch(db);

          const activeGamesSnap = await getDocs(collection(db, 'games'));
          activeGamesSnap.forEach(d => batch.delete(d.ref));

          const betsSnap = await getDocs(collection(db, 'bets'));
          betsSnap.forEach(d => batch.delete(d.ref));

          const cartelasSnap = await getDocs(collection(db, 'cartelas'));
          cartelasSnap.forEach(d => batch.delete(d.ref));

          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach(d => {
            batch.update(d.ref, { 
              betsSubmitted: false, 
              paymentStatus: 'none' 
            });
          });

          pendingGames.forEach(game => {
            const newGameRef = doc(collection(db, 'games'));
            const { id, ...gameData } = game;
            batch.set(newGameRef, { ...gameData, id: newGameRef.id });
          });

          const draftGamesSnap = await getDocs(collection(db, 'draftGames'));
          draftGamesSnap.forEach(d => batch.delete(d.ref));

          batch.update(doc(db, 'config', 'main'), {
            isBettingClosed: false,
            isAuditReady: false,
            isOverrideClosed: false
          });

          await batch.commit();
          showConfirm('Sucesso!', 'Rodada postada com sucesso! Apostas liberadas.', () => {}, 'success');
        } catch (error) {
          console.error('Error posting round:', error);
        } finally {
          setIsSavingConfig(false);
        }
      },
      'danger'
    );
  };

  return (
    <div className="space-y-8">
      {/* Gestão da Rodada (Consolidado) */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div>
            <h3 className="font-bebas text-2xl md:text-3xl text-white tracking-wider flex items-center gap-3">
              <Calendar size={28} className="text-green-primary shrink-0" /> Gestão da Rodada
            </h3>
            <p className="text-white-primary/40 text-[0.65rem] md:text-xs font-bold uppercase tracking-widest mt-1">Configure os jogos e agende o início das apostas</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="bg-yellow-primary/10 px-3 md:px-4 py-2 rounded-xl border border-yellow-primary/20 shrink-0">
              <span className="text-yellow-primary font-bebas text-lg md:text-xl">{pendingGames.length} Jogos na Preparação</span>
            </div>
            <button 
              onClick={toggleBetting}
              className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[0.65rem] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${config?.isBettingClosed ? 'bg-red-500 text-white' : 'bg-green-primary text-black'}`}
            >
              {config?.isBettingClosed ? <Lock size={14} /> : <Unlock size={14} />}
              {config?.isBettingClosed ? 'Apostas Encerradas' : 'Apostas Abertas'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna 1: Agendamento */}
          <div className="space-y-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 flex items-center gap-2">
              <Clock size={14} /> 1. Agendar Próxima Rodada
            </h4>
            <div className="space-y-4 bg-white/2 p-5 rounded-2xl border border-white/5">
              <div>
                <label className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/20 ml-1">Título da Rodada</label>
                <input 
                  type="text" 
                  value={nextRound.title}
                  onChange={(e) => setNextRound({...nextRound, title: e.target.value})}
                  placeholder="Ex: Rodada 15"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/20 ml-1">Data</label>
                  <input 
                    type="date" 
                    value={nextRound.date}
                    onChange={(e) => setNextRound({...nextRound, date: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-[0.6rem] font-bold uppercase tracking-widest text-white-primary/20 ml-1">Hora</label>
                  <input 
                    type="time" 
                    value={nextRound.time}
                    onChange={(e) => setNextRound({...nextRound, time: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary transition-all"
                  />
                </div>
              </div>
              <button 
                onClick={saveNextRound}
                disabled={isSavingConfig}
                className="w-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <Save size={16} /> {isSavingConfig ? 'Salvando...' : 'Salvar Agendamento'}
              </button>
            </div>
          </div>

          {/* Coluna 2: Adicionar Jogos */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 flex items-center gap-2">
              <Plus size={14} /> 2. Adicionar Jogos à Preparação
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/2 p-5 rounded-2xl border border-white/5">
              <div className="space-y-4">
                <div className="relative group">
                  <input 
                    type="text" placeholder="Time da Casa" value={newGame.team1}
                    onChange={(e) => {
                      setNewGame({...newGame, team1: e.target.value});
                      autoFetchLogo(e.target.value, 'logo1');
                    }}
                    onBlur={() => !newGame.logo1 && searchLogo(newGame.team1, 'logo1')}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-green-primary outline-none"
                  />
                  <button 
                    onClick={() => searchLogo(newGame.team1, 'logo1')}
                    disabled={isSearchingLogo.team1 || !newGame.team1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white-primary/20 hover:text-green-primary transition-all disabled:opacity-30"
                    title="Buscar Escudo com IA"
                  >
                    {isSearchingLogo.team1 ? <div className="w-4 h-4 border-2 border-green-primary border-t-transparent rounded-full animate-spin" /> : <Sparkles size={16} />}
                  </button>
                  {newGame.logo1 && (
                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/5 rounded-lg border border-white/10 p-1.5 flex items-center justify-center">
                      <img src={newGame.logo1} alt="Logo 1" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
                <div className="relative group">
                  <input 
                    type="text" placeholder="Time Visitante" value={newGame.team2}
                    onChange={(e) => {
                      setNewGame({...newGame, team2: e.target.value});
                      autoFetchLogo(e.target.value, 'logo2');
                    }}
                    onBlur={() => !newGame.logo2 && searchLogo(newGame.team2, 'logo2')}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-green-primary outline-none"
                  />
                  <button 
                    onClick={() => searchLogo(newGame.team2, 'logo2')}
                    disabled={isSearchingLogo.team2 || !newGame.team2}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white-primary/20 hover:text-green-primary transition-all disabled:opacity-30"
                    title="Buscar Escudo com IA"
                  >
                    {isSearchingLogo.team2 ? <div className="w-4 h-4 border-2 border-green-primary border-t-transparent rounded-full animate-spin" /> : <Sparkles size={16} />}
                  </button>
                  {newGame.logo2 && (
                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/5 rounded-lg border border-white/10 p-1.5 flex items-center justify-center">
                      <img src={newGame.logo2} alt="Logo 2" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="date" value={newGame.date}
                    onChange={(e) => setNewGame({...newGame, date: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-green-primary outline-none"
                  />
                  <input 
                    type="time" value={newGame.time}
                    onChange={(e) => setNewGame({...newGame, time: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-green-primary outline-none"
                  />
                </div>
                <button onClick={addGameToPreparation} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10">
                  <Plus size={18} /> Adicionar Jogo
                </button>
              </div>
            </div>

            {/* Lista de Jogos em Preparação */}
            <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {pendingGames.map((game, index) => (
                  <motion.div 
                    key={game.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center font-bebas text-[0.6rem] md:text-xs text-white/40 shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-end min-w-0">
                          <span className="font-bebas text-sm md:text-lg text-right truncate">{game.team1}</span>
                          {game.logo1 && <img src={game.logo1} alt="" className="w-5 h-5 md:w-6 md:h-6 object-contain shrink-0" referrerPolicy="no-referrer" />}
                        </div>
                        <span className="text-white/10 font-black italic text-[0.5rem] md:text-[0.6rem] shrink-0">VS</span>
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-start min-w-0">
                          {game.logo2 && <img src={game.logo2} alt="" className="w-5 h-5 md:w-6 md:h-6 object-contain shrink-0" referrerPolicy="no-referrer" />}
                          <span className="font-bebas text-sm md:text-lg text-left truncate">{game.team2}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => removePendingGame(game.id)}
                      className="p-2 text-white-primary/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {pendingGames.length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl">
                  <p className="text-white-primary/20 text-xs italic">Nenhum jogo na preparação.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Postar Rodada (Destaque) */}
        <div className="pt-6 border-t border-white/5 flex justify-center">
          <button 
            onClick={postRound}
            disabled={isSavingConfig}
            className="max-w-md w-full bg-green-primary hover:bg-green-600 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(0,200,83,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send size={24} /> 
            <div className="text-left">
              <div className="text-xs uppercase tracking-widest leading-none mb-1 opacity-70">Tudo Pronto?</div>
              <div className="text-xl leading-none">POSTAR NOVA RODADA</div>
            </div>
          </button>
        </div>
      </div>

      {/* Active Games Section (Results) */}
      {activeGames.length > 0 && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 space-y-8">
          <div>
            <h3 className="font-bebas text-3xl text-white tracking-wider">Resultados da Rodada Ativa</h3>
            <p className="text-white-primary/40 text-xs font-bold uppercase tracking-widest mt-1">Defina os resultados para validar os ganhadores</p>
          </div>

          <div className="grid gap-4">
            {activeGames.map((game) => (
              <div key={game.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1">
                  <div className="flex-1 flex items-center justify-end gap-3">
                    <span className="font-bebas text-2xl uppercase truncate">{game.team1}</span>
                    {game.logo1 && <img src={game.logo1} alt="" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="text-white/10 font-black italic">VS</div>
                  <div className="flex-1 flex items-center justify-start gap-3">
                    {game.logo2 && <img src={game.logo2} alt="" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />}
                    <span className="font-bebas text-2xl uppercase truncate">{game.team2}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                  {[
                    { id: 'win1', label: 'Time 1' },
                    { id: 'draw', label: 'Empate' },
                    { id: 'win2', label: 'Time 2' }
                  ].map((res) => (
                    <button
                      key={res.id}
                      onClick={() => updateResult(game.id, res.id as Game['result'])}
                      className={`px-4 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest transition-all ${game.result === res.id ? 'bg-green-primary text-black shadow-lg' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
                    >
                      {res.label}
                    </button>
                  ))}
                  <button
                    onClick={() => updateResult(game.id, 'pending')}
                    className={`px-4 py-2 rounded-lg text-[0.6rem] font-black uppercase tracking-widest transition-all ${game.result === 'pending' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
                  >
                    Pendente
                  </button>
                </div>

                <button 
                  onClick={() => removeActiveGame(game.id)}
                  className="p-3 text-white-primary/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111418] border border-white/10 rounded-[32px] p-8 max-w-md w-full space-y-6 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' :
                confirmModal.type === 'success' ? 'bg-green-primary/10 text-green-primary' :
                'bg-yellow-primary/10 text-yellow-primary'
              }`}>
                {confirmModal.type === 'danger' ? <AlertTriangle size={40} /> : 
                 confirmModal.type === 'success' ? <Check size={40} /> : 
                 <AlertTriangle size={40} />}
              </div>

              <div className="space-y-2">
                <h4 className="font-bebas text-4xl text-white uppercase tracking-wider">{confirmModal.title}</h4>
                <p className="text-white-primary/60 text-sm leading-relaxed">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, show: false }));
                  }}
                  className={`flex-1 px-6 py-4 font-black rounded-2xl transition-all shadow-lg ${
                    confirmModal.type === 'danger' ? 'bg-red-500 text-white hover:bg-red-600' :
                    confirmModal.type === 'success' ? 'bg-green-primary text-black hover:bg-green-primary/90' :
                    'bg-yellow-primary text-black hover:bg-yellow-primary/90'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
