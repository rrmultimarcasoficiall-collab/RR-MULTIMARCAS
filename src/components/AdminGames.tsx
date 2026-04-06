import React, { useState, useEffect } from 'react';
import { db, collection, doc, setDoc, getDocs, onSnapshot, updateDoc, deleteDoc, writeBatch, query, orderBy } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Game, BolaoData, Team } from '../types';
import { Trash2, Plus, Check, Clock, Calendar, Save, Lock, Unlock, Send, AlertTriangle, X, Search, Sparkles, Image as ImageIcon, Edit2, RotateCcw } from 'lucide-react';
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
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<'draft' | 'active' | null>(null);
  const [logoPicker, setLogoPicker] = useState<{ show: boolean, field: 'logo1' | 'logo2', search: string }>({ show: false, field: 'logo1', search: '' });
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [foundGames, setFoundGames] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'success' | 'warning' }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  });

  const autoFetchLogo = (teamName: string, field: 'logo1' | 'logo2') => {
    if (!teamName) return;
    const normalizedInput = teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const foundTeam = teams.find(t => {
      const normalizedTeamName = t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return normalizedTeamName === normalizedInput || normalizedTeamName.includes(normalizedInput) || normalizedInput.includes(normalizedTeamName);
    });
    if (foundTeam) {
      setNewGame(prev => ({ ...prev, [field]: foundTeam.logo }));
      return true;
    }
    return false;
  };

  const selectLogoFromPicker = (logoUrl: string, teamName: string) => {
    setNewGame(prev => ({
      ...prev,
      [logoPicker.field]: logoUrl,
      [logoPicker.field === 'logo1' ? 'team1' : 'team2']: teamName
    }));
    setLogoPicker({ ...logoPicker, show: false, search: '' });
  };

  const askAssistant = async () => {
    if (!assistantPrompt) return;
    setIsAssistantLoading(true);
    setAssistantResponse(null);
    setFoundGames([]);

    try {
      const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
      if (!apiKey) throw new Error('GEMINI_API_KEY not found');

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Você é um assistente especializado em futebol brasileiro. 
        Sua tarefa é encontrar jogos APENAS do Campeonato Brasileiro (Série A ou Série B).
        Pergunta do usuário: ${assistantPrompt}
        
        REGRAS CRÍTICAS:
        1. Ignore qualquer pedido de jogos de ligas estrangeiras (Europa, etc).
        2. Se o usuário não especificar a data, tente encontrar a rodada mais próxima.
        3. Retorne os dados no formato JSON solicitado.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING, description: "A brief explanation of what was found." },
              games: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    team1: { type: Type.STRING },
                    team2: { type: Type.STRING },
                    date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
                    time: { type: Type.STRING, description: "Time in HH:MM format" }
                  },
                  required: ["team1", "team2", "date", "time"]
                }
              }
            },
            required: ["explanation", "games"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setAssistantResponse(data.explanation);
      setFoundGames(data.games || []);
    } catch (error) {
      console.error('Error with assistant:', error);
      setAssistantResponse('Desculpe, ocorreu um erro ao buscar os jogos. Tente novamente.');
    } finally {
      setIsAssistantLoading(false);
    }
  };

  const applyAssistantGames = async () => {
    if (foundGames.length === 0) return;
    
    const batch = writeBatch(db);
    foundGames.forEach((game, idx) => {
      const id = `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
      
      // Try to find logos in our database
      const team1Data = teams.find(t => t.name.toLowerCase().trim() === game.team1.toLowerCase().trim());
      const team2Data = teams.find(t => t.name.toLowerCase().trim() === game.team2.toLowerCase().trim());

      batch.set(doc(collection(db, 'draftGames'), id), {
        team1: game.team1,
        team2: game.team2,
        logo1: team1Data?.logo || '',
        logo2: team2Data?.logo || '',
        date: game.date,
        time: game.time,
        id,
        result: 'pending',
        order: pendingGames.length + idx + 1
      });
    });

    try {
      await batch.commit();
      setAssistantPrompt('');
      setAssistantResponse(null);
      setFoundGames([]);
    } catch (error) {
      console.error('Error applying games:', error);
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
    
    if (editingGameId && editingSource) {
      try {
        const collectionName = editingSource === 'active' ? 'games' : 'draftGames';
        await updateDoc(doc(db, collectionName, editingGameId), {
          ...newGame
        });
        setEditingGameId(null);
        setEditingSource(null);
        setNewGame({ team1: '', team2: '', logo1: '', logo2: '', date: '', time: '', order: 0 });
        showConfirm('Sucesso', 'Jogo atualizado com sucesso!', () => {}, 'success');
      } catch (error) {
        console.error('Error updating game:', error);
      }
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'draftGames', id), {
      ...newGame,
      id,
      result: 'pending',
      order: pendingGames.length + 1
    });
    setNewGame({ team1: '', team2: '', logo1: '', logo2: '', date: '', time: '', order: 0 });
  };

  const editGame = (game: Game, source: 'draft' | 'active') => {
    setEditingGameId(game.id);
    setEditingSource(source);
    setNewGame({
      team1: game.team1,
      team2: game.team2,
      logo1: game.logo1 || '',
      logo2: game.logo2 || '',
      date: game.date || '',
      time: game.time || '',
      order: game.order || 0
    });
    // Scroll to form
    const element = document.getElementById('game-form-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEdit = () => {
    setEditingGameId(null);
    setEditingSource(null);
    setNewGame({ team1: '', team2: '', logo1: '', logo2: '', date: '', time: '', order: 0 });
  };

  const simulateGames = async () => {
    const simulationGames = [
      { team1: 'Flamengo', team2: 'Palmeiras' },
      { team1: 'São Paulo', team2: 'Corinthians' },
      { team1: 'Atlético-MG', team2: 'Cruzeiro' },
      { team1: 'Grêmio', team2: 'Internacional' },
      { team1: 'Fluminense', team2: 'Botafogo' },
      { team1: 'Vasco', team2: 'Bahia' },
      { team1: 'Athletico-PR', team2: 'Coritiba' },
      { team1: 'Fortaleza', team2: 'Ceará' },
    ];

    const fallbackLogos: Record<string, string> = {
      'Flamengo': 'https://upload.wikimedia.org/wikipedia/pt/2/2e/Flamengo_brazilian_v_logo.png',
      'Palmeiras': 'https://upload.wikimedia.org/wikipedia/pt/1/10/Palmeiras_logo.png',
      'São Paulo': 'https://upload.wikimedia.org/wikipedia/pt/4/4b/Sao_Paulo_Futebol_Clube.png',
      'Corinthians': 'https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png',
      'Atlético-MG': 'https://upload.wikimedia.org/wikipedia/pt/f/f4/Atletico_mineiro_galo.png',
      'Cruzeiro': 'https://upload.wikimedia.org/wikipedia/pt/b/b3/Cruzeiro_Esporte_Clube.png',
      'Grêmio': 'https://upload.wikimedia.org/wikipedia/pt/f/f1/Gremio_logo.png',
      'Internacional': 'https://upload.wikimedia.org/wikipedia/pt/d/d1/Internacional_logo.png',
      'Fluminense': 'https://upload.wikimedia.org/wikipedia/pt/a/a3/Fluminense_FC_escudo.png',
      'Botafogo': 'https://upload.wikimedia.org/wikipedia/pt/c/c7/Botafogo_de_Futebol_e_Regatas_logo.png',
      'Vasco': 'https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascoDaGama.png',
      'Bahia': 'https://upload.wikimedia.org/wikipedia/pt/b/b4/EC_Bahia_logo.png',
      'Athletico-PR': 'https://upload.wikimedia.org/wikipedia/pt/c/c7/Club_Athletico_Paranaense_2018.png',
      'Coritiba': 'https://upload.wikimedia.org/wikipedia/pt/3/38/Coritiba_FBC_%282011%29.png',
      'Fortaleza': 'https://upload.wikimedia.org/wikipedia/pt/4/41/Fortaleza_Esporte_Clube_logo.png',
      'Ceará': 'https://upload.wikimedia.org/wikipedia/pt/5/54/Cear%C3%A1_Sporting_Club_logo.png'
    };

    setIsSavingConfig(true);
    try {
      const batch = writeBatch(db);
      
      const draftGamesSnap = await getDocs(collection(db, 'draftGames'));
      draftGamesSnap.forEach(d => batch.delete(d.ref));

      simulationGames.forEach((game, idx) => {
        const team1Data = teams.find(t => t.name.toLowerCase().trim() === game.team1.toLowerCase());
        const team2Data = teams.find(t => t.name.toLowerCase().trim() === game.team2.toLowerCase());

        const logo1 = team1Data?.logo || fallbackLogos[game.team1];
        const logo2 = team2Data?.logo || fallbackLogos[game.team2];

        const newGameRef = doc(collection(db, 'draftGames'));
        batch.set(newGameRef, { 
          team1: game.team1,
          team2: game.team2,
          logo1,
          logo2,
          date: '2024-04-10',
          time: '16:00',
          id: newGameRef.id, 
          result: 'pending',
          order: idx + 1
        });
      });
      await batch.commit();
      showConfirm('Sucesso!', '8 jogos de simulação adicionados à preparação!', () => {}, 'success');
    } catch (error) {
      console.error('Error simulating games:', error);
    } finally {
      setIsSavingConfig(false);
    }
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
      <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-4 md:p-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="pt-12 lg:pt-0">
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
              className={`flex-1 lg:flex-none px-4 md:px-6 py-2.5 rounded-xl font-bold text-[0.65rem] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 ${config?.isBettingClosed ? 'bg-red-500 text-white' : 'bg-green-primary text-black'}`}
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
            <div className="space-y-4 bg-white/2 p-4 md:p-5 rounded-2xl border border-white/5 h-full">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Coluna 2: Assistente IA */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 flex items-center gap-2">
              <Sparkles size={14} className="text-green-primary" /> Assistente IA (Brasileirão A e B)
            </h4>
            <div className="bg-white/2 p-4 md:p-5 rounded-2xl border border-white/5 space-y-4 h-full flex flex-col">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    placeholder="Ex: Jogos do Brasileirão dia 11/04"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-green-primary outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && askAssistant()}
                  />
                  <button 
                    onClick={askAssistant}
                    disabled={isAssistantLoading || !assistantPrompt}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-green-primary hover:bg-green-primary/10 rounded-lg transition-all disabled:opacity-30"
                  >
                    {isAssistantLoading ? <div className="w-5 h-5 border-2 border-green-primary border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-black/20 rounded-xl p-4 border border-white/5 min-h-[120px] max-h-[250px] overflow-y-auto scrollbar-hide">
                {isAssistantLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20 py-4">
                    <Sparkles size={24} className="animate-pulse" />
                    <p className="text-[0.6rem] uppercase tracking-widest font-bold">Buscando jogos brasileiros...</p>
                  </div>
                ) : assistantResponse ? (
                  <div className="space-y-4">
                    <p className="text-sm text-white/60 leading-relaxed">{assistantResponse}</p>
                    {foundGames.length > 0 && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-green-primary">{foundGames.length} Jogos Encontrados</span>
                          <button 
                            onClick={applyAssistantGames}
                            className="w-full sm:w-auto bg-green-primary text-black text-[0.6rem] font-black uppercase tracking-widest px-3 py-2 rounded-lg hover:scale-105 transition-all"
                          >
                            Preencher Tudo
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {foundGames.map((g, i) => (
                            <div key={i} className="bg-white/5 rounded-lg p-2 text-[0.65rem] border border-white/5 flex items-center justify-between gap-2">
                              <span className="truncate flex-1">{g.team1} x {g.team2}</span>
                              <span className="text-white/40 shrink-0">{g.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white/10 text-center px-4 py-4">
                    <p className="text-xs italic">Peça os jogos do Brasileirão para a IA.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Adicionar Jogos Manualmente */}
        <div id="game-form-section" className="space-y-4 pt-4 border-t border-white/5">
          <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 flex items-center gap-2">
            {editingGameId ? <Edit2 size={14} /> : <Plus size={14} />} 
            {editingGameId ? `2. Editando Jogo (${editingSource === 'active' ? 'Ativo' : 'Preparação'})` : '2. Adicionar Jogos Manualmente'}
          </h4>
          <div className={`bg-white/2 p-4 md:p-5 rounded-2xl border transition-all duration-500 ${editingGameId ? 'border-green-primary/50 shadow-[0_0_30px_rgba(0,200,83,0.1)]' : 'border-white/5'} space-y-6`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Time 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 p-2 flex items-center justify-center shrink-0 overflow-hidden">
                    {newGame.logo1 ? (
                      <img 
                        src={newGame.logo1} 
                        alt="" 
                        className="max-w-full max-h-full object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                        }}
                      />
                    ) : (
                      <ImageIcon className="text-white/10" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" placeholder="Time da Casa" value={newGame.team1}
                      list="teams-list"
                      onChange={(e) => {
                        setNewGame({...newGame, team1: e.target.value});
                        autoFetchLogo(e.target.value, 'logo1');
                      }}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-green-primary outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="URL do Escudo 1" value={newGame.logo1}
                    onChange={(e) => setNewGame({...newGame, logo1: e.target.value})}
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-[0.7rem] text-white/60 focus:border-green-primary outline-none"
                  />
                  <button 
                    onClick={() => setLogoPicker({ show: true, field: 'logo1', search: newGame.team1 })}
                    type="button"
                    className="px-3 py-2 bg-green-primary/10 text-green-primary text-[0.6rem] font-bold rounded-xl border border-green-primary/20 hover:bg-green-primary/20 transition-all shrink-0 flex items-center gap-2"
                  >
                    <Search size={12} /> Selecionar
                  </button>
                </div>
              </div>

              {/* Time 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 p-2 flex items-center justify-center shrink-0 overflow-hidden">
                    {newGame.logo2 ? (
                      <img 
                        src={newGame.logo2} 
                        alt="" 
                        className="max-w-full max-h-full object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                        }}
                      />
                    ) : (
                      <ImageIcon className="text-white/10" size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" placeholder="Time Visitante" value={newGame.team2}
                      list="teams-list"
                      onChange={(e) => {
                        setNewGame({...newGame, team2: e.target.value});
                        autoFetchLogo(e.target.value, 'logo2');
                      }}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-green-primary outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="URL do Escudo 2" value={newGame.logo2}
                    onChange={(e) => setNewGame({...newGame, logo2: e.target.value})}
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-[0.7rem] text-white/60 focus:border-green-primary outline-none"
                  />
                  <button 
                    onClick={() => setLogoPicker({ show: true, field: 'logo2', search: newGame.team2 })}
                    type="button"
                    className="px-3 py-2 bg-green-primary/10 text-green-primary text-[0.6rem] font-bold rounded-xl border border-green-primary/20 hover:bg-green-primary/20 transition-all shrink-0 flex items-center gap-2"
                  >
                    <Search size={12} /> Selecionar
                  </button>
                </div>
              </div>
            </div>

            <datalist id="teams-list">
              {teams.map(team => (
                <option key={team.id} value={team.name} />
              ))}
            </datalist>

            <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex gap-2">
                <button 
                  onClick={addGameToPreparation} 
                  className={`flex-1 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all border ${editingGameId ? 'bg-green-primary text-black border-green-primary shadow-[0_0_20px_rgba(0,200,83,0.2)]' : 'bg-white/10 hover:bg-white/20 text-white border-white/10'}`}
                >
                  {editingGameId ? <Check size={18} /> : <Plus size={18} />} 
                  {editingGameId ? 'Salvar Alterações' : 'Adicionar Jogo'}
                </button>
                {editingGameId ? (
                  <button 
                    onClick={cancelEdit}
                    className="px-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={18} /> <span className="hidden sm:inline">Cancelar</span>
                  </button>
                ) : (
                  <button 
                    onClick={simulateGames} 
                    disabled={isSavingConfig}
                    className="px-4 bg-green-primary/10 hover:bg-green-primary/20 text-green-primary font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-green-primary/20"
                  >
                    <Sparkles size={18} /> <span className="hidden sm:inline">Simular Rodada</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Jogos em Preparação */}
        <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence mode="popLayout">
                {pendingGames.map((game, index) => (
                  <motion.div 
                    key={game.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={`border rounded-xl p-3 flex items-center justify-between gap-4 group transition-all ${editingGameId === game.id ? 'bg-green-primary/5 border-green-primary/30' : 'bg-white/5 border-white/10'}`}
                  >
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                      <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center font-bebas text-[0.6rem] md:text-xs text-white/40 shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-end min-w-0">
                          <span className="font-bebas text-sm md:text-lg text-right truncate">{game.team1}</span>
                          {game.logo1 && (
                            <img 
                              src={game.logo1} 
                              alt="" 
                              className="w-6 h-6 md:w-8 md:h-8 object-contain shrink-0" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                              }}
                            />
                          )}
                        </div>
                        <span className="text-white/10 font-black italic text-[0.5rem] md:text-[0.6rem] shrink-0">VS</span>
                        <div className="flex items-center gap-1.5 md:gap-2 flex-1 justify-start min-w-0">
                          {game.logo2 && (
                            <img 
                              src={game.logo2} 
                              alt="" 
                              className="w-6 h-6 md:w-8 md:h-8 object-contain shrink-0" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                              }}
                            />
                          )}
                          <span className="font-bebas text-sm md:text-lg text-left truncate">{game.team2}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => editGame(game, 'draft')}
                        className="p-2 text-white-primary/20 hover:text-green-primary hover:bg-green-primary/10 rounded-lg transition-all"
                        title="Editar Jogo"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => removePendingGame(game.id)}
                        className="p-2 text-white-primary/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Excluir Jogo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {pendingGames.length === 0 && (
                <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl">
                  <p className="text-white-primary/20 text-xs italic">Nenhum jogo na preparação.</p>
                </div>
              )}
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
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-4 md:p-8 space-y-8">
          <div>
            <h3 className="font-bebas text-2xl md:text-3xl text-white tracking-wider">Resultados da Rodada Ativa</h3>
            <p className="text-white-primary/40 text-[0.65rem] md:text-xs font-bold uppercase tracking-widest mt-1">Defina os resultados para validar os ganhadores</p>
          </div>

          <div className="grid gap-4">
            {activeGames.map((game) => (
              <div key={game.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4 md:gap-6 flex-1">
                  <div className="flex-1 flex items-center justify-end gap-2 md:gap-3">
                    <span className="font-bebas text-lg md:text-2xl uppercase truncate">{game.team1}</span>
                    {game.logo1 && (
                      <img 
                        src={game.logo1} 
                        alt="" 
                        className="w-8 h-8 md:w-10 md:h-10 object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                        }}
                      />
                    )}
                  </div>
                  <div className="text-white/10 font-black italic text-xs md:text-base">VS</div>
                  <div className="flex-1 flex items-center justify-start gap-2 md:gap-3">
                    {game.logo2 && (
                      <img 
                        src={game.logo2} 
                        alt="" 
                        className="w-8 h-8 md:w-10 md:h-10 object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/53/53254.png';
                        }}
                      />
                    )}
                    <span className="font-bebas text-lg md:text-2xl uppercase truncate">{game.team2}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                  {[
                    { id: 'win1', label: 'Time 1' },
                    { id: 'draw', label: 'Empate' },
                    { id: 'win2', label: 'Time 2' },
                    { id: 'pending', label: 'Pendente' }
                  ].map((res) => (
                    <button
                      key={res.id}
                      onClick={() => updateResult(game.id, res.id as Game['result'])}
                      className={`px-3 py-2 rounded-lg text-[0.55rem] md:text-[0.6rem] font-black uppercase tracking-widest transition-all ${game.result === res.id ? 'bg-green-primary text-black shadow-lg' : 'text-white/20 hover:text-white/40 hover:bg-white/5'}`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
                  <button 
                    onClick={() => editGame(game, 'active')}
                    className="p-3 text-white-primary/20 hover:text-green-primary hover:bg-green-primary/10 rounded-xl transition-all"
                    title="Editar Jogo"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button 
                    onClick={() => removeActiveGame(game.id)}
                    className="p-3 text-white-primary/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    title="Excluir Jogo"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Seletor de Escudos */}
      <AnimatePresence>
        {logoPicker.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLogoPicker({ ...logoPicker, show: false })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                <div>
                  <h3 className="font-bebas text-2xl text-white tracking-wider">Selecionar Escudo</h3>
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/40">Escolha um time do seu banco de dados</p>
                </div>
                <button 
                  onClick={() => setLogoPicker({ ...logoPicker, show: false })}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/20 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Buscar time..."
                    value={logoPicker.search}
                    onChange={(e) => setLogoPicker({ ...logoPicker, search: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-green-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 scrollbar-hide">
                {teams
                  .filter(t => t.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(logoPicker.search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
                  .map(team => (
                    <button
                      key={team.id}
                      onClick={() => selectLogoFromPicker(team.logo, team.name)}
                      className="group bg-white/2 hover:bg-green-primary/10 border border-white/5 hover:border-green-primary/30 rounded-2xl p-4 transition-all flex flex-col items-center gap-3 text-center"
                    >
                      <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                        <img 
                          src={team.logo} 
                          alt={team.name} 
                          className="max-w-full max-h-full object-contain group-hover:scale-110 transition-all duration-500" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-white/60 group-hover:text-white truncate w-full">
                        {team.name}
                      </span>
                    </button>
                  ))
                }
                {teams.filter(t => t.name.toLowerCase().includes(logoPicker.search.toLowerCase())).length === 0 && (
                  <div className="col-span-full py-12 text-center space-y-3">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/10">
                      <Search size={24} />
                    </div>
                    <p className="text-xs text-white/20 italic">Nenhum time encontrado com esse nome.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
