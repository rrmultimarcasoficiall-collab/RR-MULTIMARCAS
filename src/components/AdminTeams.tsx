import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Team } from '../types';
import { Trash2, Plus, Search, Smartphone, ShieldCheck, Edit2, RefreshCw, X as LucideX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [pendingBatch, setPendingBatch] = useState<{ name: string, logo: string }[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTeams = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching teams:', error);
        setTeams([]);
      } else {
        setTeams((data || []) as Team[]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    
    // Safety timeout to prevent stuck loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleAddTeam = async () => {
    if (!newTeamName || !newTeamLogo) return;
    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update({
            name: newTeamName.trim(),
            logo: newTeamLogo
          })
          .eq('id', editingTeam.id);
        
        if (error) throw error;
        setTeams(prev => prev.map(t => t.id === editingTeam.id ? { ...t, name: newTeamName.trim(), logo: newTeamLogo } : t));
      } else {
        const { data, error } = await supabase
          .from('teams')
          .insert({
            name: newTeamName.trim(),
            logo: newTeamLogo
          })
          .select()
          .single();
        
        if (error) throw error;
        setTeams(prev => [...prev, data as Team].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setNewTeamName('');
      setNewTeamLogo('');
      setIsAdding(false);
      setEditingTeam(null);
      setSuccessMsg(editingTeam ? 'Escudo atualizado!' : 'Escudo salvo!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error: any) {
      console.error('Error saving team:', error);
      setErrorMsg(`Erro ao salvar: ${error.message || 'Verifique as regras do Supabase'}`);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setNewTeamName(team.name);
    setNewTeamLogo(team.logo);
    setIsAdding(true);
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamToDelete);
      
      if (error) throw error;
      setTeams(prev => prev.filter(t => t.id !== teamToDelete));
      setTeamToDelete(null);
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    
    // If only one file, just populate the fields and let the user click Save
    if (fileList.length === 1) {
      const file = fileList[0];
      if (file.size > 800000) {
        setErrorMsg('A imagem é muito grande! Tente uma imagem menor que 800KB.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTeamLogo(reader.result as string);
        setNewTeamName(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim());
      };
      reader.readAsDataURL(file);
      return;
    }

    // If multiple files, prepare for batch upload
    const batch: { name: string, logo: string }[] = [];
    setIsBatchUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      
      // Pequena pausa para a interface atualizar
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress({ current: i + 1, total: fileList.length });

      if (file.size > 1000000) { // Aumentado para 1MB
        console.warn(`Arquivo ${file.name} ignorado: muito grande (>1MB)`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
          reader.readAsDataURL(file);
        });

        const teamName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .trim();
        
        batch.push({ name: teamName, logo: base64 });
      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error);
      }
    }

    setIsBatchUploading(false);
    if (batch.length > 0) {
      setPendingBatch(batch);
    } else {
      setErrorMsg('Nenhum arquivo válido selecionado para subir.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
    
    e.target.value = '';
  };

  const handleConfirmBatchUpload = async () => {
    if (pendingBatch.length === 0) return;
    
    setIsBatchUploading(true);
    setUploadProgress({ current: 0, total: pendingBatch.length });
    
    try {
      const chunkSize = 2; // Reduzido para 2 para evitar erro de tamanho de pacote
      const newTeamsList: Team[] = [];
      
      for (let i = 0; i < pendingBatch.length; i += chunkSize) {
        const chunk = pendingBatch.slice(i, i + chunkSize);
        
        const { data, error } = await supabase
          .from('teams')
          .insert(chunk)
          .select();
        
        if (error) {
          // Se der erro em um lote, mostramos o erro específico
          throw new Error(error.message);
        }
        
        if (data) newTeamsList.push(...(data as Team[]));
        
        setUploadProgress(prev => ({ ...prev, current: Math.min(i + chunkSize, pendingBatch.length) }));
      }
      
      setTeams(prev => [...prev, ...newTeamsList].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccessMsg(`${newTeamsList.length} escudos subidos com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      
      setPendingBatch([]);
      setIsAdding(false);
    } catch (error: any) {
      console.error('Erro no upload em lote:', error);
      setErrorMsg(`Erro: ${error.message || 'Falha ao salvar. Tente subir menos arquivos.'}`);
      setTimeout(() => setErrorMsg(null), 6000);
    } finally {
      setIsBatchUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (v: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        setErrorMsg('A imagem é muito grande! Tente uma imagem menor que 800KB.');
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        callback(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-center py-12 text-white-primary/40 italic">Carregando escudos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-bebas text-2xl text-white">Banco de Escudos</h3>
            <p className="text-xs text-white-primary/40 uppercase tracking-widest">Gerencie os logotipos dos times</p>
          </div>
          <button 
            onClick={fetchTeams}
            disabled={isRefreshing}
            className="p-2 bg-white/5 text-white-primary/40 rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            title="Atualizar Lista"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-green-primary hover:bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-green-primary/20"
        >
          <Plus size={16} /> Novo Escudo
        </button>
      </div>

      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white-primary/20 group-focus-within:text-green-primary transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Buscar time..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-green-primary transition-all text-sm"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <AnimatePresence>
          {filteredTeams.map((team) => (
            <motion.div 
              key={team.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 group relative"
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-all z-10">
                <button 
                  onClick={() => handleEditTeam(team)}
                  className="p-2 text-white bg-black/60 hover:bg-green-primary rounded-lg transition-all border border-white/10"
                  title="Editar Nome"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => setTeamToDelete(team.id)}
                  className="p-2 text-white bg-black/60 hover:bg-red-500 rounded-lg transition-all border border-white/10"
                  title="Excluir Escudo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 p-2 flex items-center justify-center">
                <img src={team.logo} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-center truncate w-full text-white-primary/60">{team.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {teamToDelete && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111418] border border-white/10 rounded-3xl p-8 w-full max-w-md space-y-6"
          >
            <div className="flex items-center gap-4 text-red-500">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <h4 className="font-bebas text-2xl">Excluir Escudo?</h4>
            </div>
            
            <p className="text-white-primary/60 text-sm leading-relaxed">
              Tem certeza que deseja excluir este escudo permanentemente? Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setTeamToDelete(null)}
                className="flex-1 px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteTeam}
                className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all"
              >
                Confirmar Exclusão
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111418] border border-white/10 rounded-3xl p-8 w-full max-w-md space-y-6"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bebas text-2xl">{editingTeam ? 'Editar Escudo' : 'Adicionar Novo Escudo'}</h4>
              <button onClick={() => { setIsAdding(false); setEditingTeam(null); setNewTeamName(''); setNewTeamLogo(''); }} className="text-white-primary/40 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-xs font-bold text-center animate-shake">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-xl text-xs font-bold text-center">
                  {successMsg}
                </div>
              )}
              {isBatchUploading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-green-primary/10 border-t-green-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold text-green-primary">
                      {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-bebas text-2xl tracking-wide">Processando Arquivos...</p>
                    <p className="text-xs text-white-primary/40 uppercase tracking-widest">
                      {uploadProgress.current} de {uploadProgress.total} concluídos
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsBatchUploading(false)}
                    className="text-[0.65rem] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest underline underline-offset-4"
                  >
                    Cancelar Processamento
                  </button>
                </div>
              ) : pendingBatch.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40 mb-2">
                      {pendingBatch.length} Escudos Prontos para Subir
                    </p>
                    {pendingBatch.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
                        <img src={item.logo} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                        <span className="text-xs truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setPendingBatch([])}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleConfirmBatchUpload}
                      className="flex-1 py-3 bg-green-primary hover:bg-green-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest shadow-lg shadow-green-primary/20"
                    >
                      Confirmar Upload
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40">Nome do Time</label>
                    <input 
                      type="text" 
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Ex: Flamengo, Palmeiras..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-primary transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[0.65rem] font-bold uppercase tracking-widest text-white-primary/40">Logo (URL ou Upload)</label>
                    <input 
                      type="text" 
                      value={newTeamLogo}
                      onChange={(e) => setNewTeamLogo(e.target.value)}
                      placeholder="Cole a URL da imagem..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-primary transition-all text-sm"
                    />
                    <div className="flex flex-col gap-4 mt-2">
                      <div className="flex items-center gap-4">
                        <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-[0.65rem] font-bold uppercase tracking-widest py-2 px-4 rounded-lg transition-all flex items-center gap-2">
                          <Smartphone size={14} /> Selecionar Arquivos
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            className="hidden" 
                            onChange={handleMultipleFilesChange} 
                          />
                        </label>
                        {newTeamLogo && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 p-1 bg-white/5">
                            <img src={newTeamLogo} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                      <p className="text-[0.6rem] text-white-primary/30 italic">
                        * Você pode selecionar vários arquivos de uma vez. O nome do time será o nome do arquivo.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!isBatchUploading && pendingBatch.length === 0 && (
              <button 
                onClick={handleAddTeam}
                disabled={!newTeamName || !newTeamLogo}
                className="w-full py-4 bg-green-primary hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-primary text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-primary/20"
              >
                {editingTeam ? 'ATUALIZAR ESCUDO' : 'SALVAR ESCUDO'}
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function X({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
