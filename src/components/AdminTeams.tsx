import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Team } from '../types';
import { Trash2, Plus, Search, Smartphone, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('');
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setTeams(teamsData.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAddTeam = async () => {
    if (!newTeamName || !newTeamLogo) return;
    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName.trim(),
        logo: newTeamLogo
      });
      setNewTeamName('');
      setNewTeamLogo('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding team:', error);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este escudo?')) return;
    try {
      await deleteDoc(doc(db, 'teams', id));
    } catch (error) {
      console.error('Error deleting team:', error);
    }
  };

  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBatchUploading(true);
    const fileList = Array.from(files) as File[];
    setUploadProgress({ current: 0, total: fileList.length });
    
    let count = 0;
    for (const file of fileList) {
      count++;
      setUploadProgress(prev => ({ ...prev, current: count }));

      if (file.size > 800000) {
        console.warn(`Arquivo ${file.name} ignorado: muito grande (>800KB)`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Use filename as team name (remove extension and replace separators)
        const teamName = file.name
          .replace(/\.[^/.]+$/, "") // remove extension
          .replace(/[-_]/g, " ")    // replace dashes/underscores with spaces
          .trim();
        
        await addDoc(collection(db, 'teams'), {
          name: teamName,
          logo: base64
        });
      } catch (error) {
        console.error(`Erro ao subir ${file.name}:`, error);
      }
    }
    
    setIsBatchUploading(false);
    setIsAdding(false);
    setNewTeamName('');
    setNewTeamLogo('');
    // Reset the input value so the same files can be selected again if needed
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (v: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        alert('A imagem é muito grande! Tente uma imagem menor que 800KB.');
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
        <div>
          <h3 className="font-bebas text-2xl text-white">Banco de Escudos</h3>
          <p className="text-xs text-white-primary/40 uppercase tracking-widest">Gerencie os logotipos dos times</p>
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
              <button 
                onClick={() => handleDeleteTeam(team.id)}
                className="absolute top-2 right-2 p-1.5 text-white-primary/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 p-2 flex items-center justify-center">
                <img src={team.logo} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
              <span className="text-[0.65rem] font-bold uppercase tracking-widest text-center truncate w-full text-white-primary/60">{team.name}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111418] border border-white/10 rounded-3xl p-8 w-full max-w-md space-y-6"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bebas text-2xl">Adicionar Novo Escudo</h4>
              <button onClick={() => setIsAdding(false)} className="text-white-primary/40 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {isBatchUploading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 border-4 border-green-primary/20 border-t-green-primary rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="font-bebas text-xl">Subindo Escudos...</p>
                    <p className="text-xs text-white-primary/40 uppercase tracking-widest">
                      {uploadProgress.current} de {uploadProgress.total} concluídos
                    </p>
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

            {!isBatchUploading && (
              <button 
                onClick={handleAddTeam}
                disabled={!newTeamName || !newTeamLogo}
                className="w-full py-4 bg-green-primary hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-primary text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-primary/20"
              >
                SALVAR ESCUDO
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
