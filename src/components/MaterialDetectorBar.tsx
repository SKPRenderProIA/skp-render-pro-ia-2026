import React, { useState, useMemo } from 'react';
import { Sparkles, Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown, RotateCw, Filter, Maximize2, ExternalLink } from 'lucide-react';
import { DetectedMaterial } from '../types';

interface MaterialDetectorBarProps {
  materials: DetectedMaterial[];
  onUpdateMaterial: (id: string, element: string, description: string) => void;
  onDeleteMaterial: (id: string) => void;
  onAddMaterial: (element: string, description: string) => void;
  onClearMaterials: () => void;
  isDetecting: boolean;
  onDetectMaterials: () => void;
  hasImage: boolean;
  onOpenModal?: () => void;
  onOpenExternalWindow?: () => void;
}

const COMMON_PRESETS = [
  { label: 'Piso', desc: 'Porcelanato acetinado cinza claro 120x120cm retificado' },
  { label: 'Paredes', desc: 'Alvenaria com pintura mineral fosca neutra off-white' },
  { label: 'Marcenaria', desc: 'Lâmina natural de Freijó ripado com veios contínuos' },
  { label: 'Bancada & Ilha', desc: 'Mármore Branco Paraná polido com borda bisotada' },
  { label: 'Forro / Teto', desc: 'Gesso liso ultra-fosco com rasgos de LED 3000K' },
  { label: 'Sofá & Estofados', desc: 'Tecido linho cru encorpado com textura tátil' },
  { label: 'Poltrona', desc: 'Couro natural tom conhaque com pés em madeira maciça' },
  { label: 'Mesa de Centro', desc: 'Madeira maciça orgânica com pés em aço carbono preto' },
  { label: 'Tapete', desc: 'Tear manual em fibras naturais com textura tátil rica' },
  { label: 'Cortinas', desc: 'Gaze de linho fluida do teto ao chão prega wave' },
  { label: 'Pendente', desc: 'Luminária escultural em metal preto e vidro âmbar' },
  { label: 'Esquadrias & Vidros', desc: 'Alumínio preto fosco com vidro incolor cristalino' },
  { label: 'Metais & Torneira', desc: 'Monocomando gourmet preto fosco escovado' },
  { label: 'Eletrodomésticos', desc: 'Cooktop de indução em vitrocerâmica preta e forno inox' },
  { label: 'Objetos Decorativos', desc: 'Vasos de cerâmica artesanal, livros de arte e louças' },
  { label: 'Vegetação / Biofilia', desc: 'Planta natural Ficus Lyrata viçosa em cachepot' },
];

export const MaterialDetectorBar: React.FC<MaterialDetectorBarProps> = ({
  materials,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddMaterial,
  onClearMaterials,
  isDetecting,
  onDetectMaterials,
  hasImage,
  onOpenModal,
  onOpenExternalWindow,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchFilter, setSearchFilter] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editElement, setEditElement] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Add state
  const [isAdding, setIsAdding] = useState(false);
  const [newElement, setNewElement] = useState('Objetos Decorativos');
  const [newDesc, setNewDesc] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => {
      if (m.category && m.category.trim()) {
        set.add(m.category.trim());
      }
    });
    return ['Todos', ...Array.from(set)];
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat =
        selectedCategory === 'Todos' ||
        m.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !searchFilter.trim() ||
        m.element.toLowerCase().includes(searchFilter.toLowerCase()) ||
        m.description.toLowerCase().includes(searchFilter.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [materials, selectedCategory, searchFilter]);

  const startEdit = (mat: DetectedMaterial) => {
    setEditingId(mat.id);
    setEditElement(mat.element);
    setEditDesc(mat.description);
  };

  const saveEdit = () => {
    if (editingId && editElement.trim() && editDesc.trim()) {
      onUpdateMaterial(editingId, editElement.trim(), editDesc.trim());
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (newElement.trim() && newDesc.trim()) {
      onAddMaterial(newElement.trim(), newDesc.trim());
      setNewDesc('');
      setIsAdding(false);
    }
  };

  const applyPreset = (preset: { label: string; desc: string }) => {
    setNewElement(preset.label);
    setNewDesc(preset.desc);
  };

  // If no materials and not detecting, do not render
  if (!materials.length && !isDetecting) {
    return null;
  }

  return (
    <div className="w-full bg-[#f8faf9] border-t border-b border-[#396252]/20 shadow-xs text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#eef4f1] border-b border-[#396252]/15 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#1f4a36] font-bold text-[11px] tracking-wide">
            <Sparkles className={`w-3.5 h-3.5 text-[#25543f] ${isDetecting ? 'animate-spin' : ''}`} />
            <span>MATERIAIS E OBJETOS DA CENA</span>
            {materials.length > 0 && (
              <span className="bg-[#25543f] text-white px-2 py-0.2 text-[9.5px] font-bold rounded-full">
                {materials.length} itens
              </span>
            )}
          </div>
          <span className="text-[10px] text-stone-500 hidden md:inline">
            (Leitura profunda da cena com materiais, mobiliário e objetos — sincronizado no chat)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="px-2 py-0.5 text-[10px] font-bold bg-[#e1ece5] hover:bg-[#d0e2d6] text-[#1c4432] border border-[#25543f]/30 rounded flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="Expandir interface de materiais em Tela Cheia / Modal Amplo com o print lado a lado"
            >
              <Maximize2 className="w-3 h-3 text-[#25543f]" />
              <span className="hidden sm:inline">Tela Cheia</span>
            </button>
          )}

          {onOpenExternalWindow && (
            <button
              type="button"
              onClick={onOpenExternalWindow}
              className="px-2 py-0.5 text-[10px] font-bold bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="Abrir a interface de materiais fora do SketchUp (em janela externa desvinculada / navegador)"
            >
              <ExternalLink className="w-3 h-3 text-[#a7f3d0]" />
              <span className="whitespace-nowrap">Fora do Plugin</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDetectMaterials}
            disabled={isDetecting || !hasImage}
            className="px-2 py-0.5 text-[10px] font-bold text-[#25543f] hover:bg-[#d8e6df] rounded flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
            title="Re-analisar toda a cena detalhadamente com a IA"
          >
            <RotateCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Analisando...' : 'Re-ler'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-2 py-0.5 text-[10px] font-bold bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded flex items-center gap-1 transition cursor-pointer shadow-2xs"
            title="Acrescentar novo material ou objeto à cena"
          >
            <Plus className="w-3 h-3" />
            <span>Novo Item</span>
          </button>

          {materials.length > 0 && (
            <button
              type="button"
              onClick={onClearMaterials}
              className="p-1 text-stone-400 hover:text-red-600 rounded transition cursor-pointer"
              title="Limpar todos os itens detectados"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-stone-500 hover:text-[#25543f] rounded transition cursor-pointer"
            title={isExpanded ? 'Recolher painel' : 'Expandir painel'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
          {/* Quick Category & Search Filter Bar (shows if >= 5 items) */}
          {materials.length >= 5 && categories.length > 2 && (
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-stone-200/60 overflow-x-auto">
              <div className="flex items-center gap-1 overflow-x-auto shrink-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 text-[9.5px] font-semibold rounded-full whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#25543f] text-white'
                        : 'bg-[#e2ebe6] text-[#25543f] hover:bg-[#d1ded7]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar item..."
                className="w-24 sm:w-32 px-1.5 py-0.5 text-[10px] border border-stone-300 rounded bg-white outline-none focus:border-[#25543f]"
              />
            </div>
          )}

          {/* Inline Form to Add New Material / Object */}
          {isAdding && (
            <form onSubmit={handleAddNew} className="p-2.5 bg-white border border-[#396252]/40 rounded-lg shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#25543f] flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Novo Material ou Objeto
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-stone-50 rounded border border-stone-200/70">
                {COMMON_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold transition cursor-pointer ${
                      newElement === p.label
                        ? 'bg-[#25543f] text-white'
                        : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                    }`}
                    title={p.desc}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={newElement}
                  onChange={(e) => setNewElement(e.target.value)}
                  placeholder="Elemento (ex: Mesa de Centro)"
                  className="p-1.5 text-[11px] border border-stone-300 rounded font-bold text-stone-800 outline-none focus:border-[#25543f]"
                  required
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Especificação (ex: Madeira maciça e base em ferro preto fosco)"
                  className="sm:col-span-2 p-1.5 text-[11px] border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-2.5 py-1 text-[10.5px] text-stone-600 hover:bg-stone-100 rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-[10.5px] font-bold rounded flex items-center gap-1 transition cursor-pointer shadow-xs"
                >
                  <Check className="w-3 h-3" />
                  <span>Adicionar à Cena</span>
                </button>
              </div>
            </form>
          )}

          {/* Items List */}
          {filteredMaterials.length === 0 ? (
            <div className="py-4 text-center text-stone-500 italic text-[11px]">
              {materials.length === 0
                ? 'Nenhum material ou objeto detectado ainda. Clique em "Re-ler Cena" com um print ativo.'
                : 'Nenhum item encontrado no filtro atual.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {filteredMaterials.map((mat) => {
                const isEditing = editingId === mat.id;

                if (isEditing) {
                  return (
                    <div
                      key={mat.id}
                      className="p-2 bg-white border-2 border-[#25543f] rounded-md shadow-xs space-y-1.5 col-span-1 md:col-span-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        <input
                          type="text"
                          value={editElement}
                          onChange={(e) => setEditElement(e.target.value)}
                          className="p-1.5 text-[11px] font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                          placeholder="Elemento ou Objeto"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="sm:col-span-2 p-1.5 text-[11px] border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                          placeholder="Descrição técnica PBR / Acabamento"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2.5 py-1 text-[10px] text-stone-600 hover:bg-stone-100 rounded cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="px-3 py-1 bg-[#25543f] text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3 h-3" /> Salvar Alteração
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={mat.id}
                    className="flex items-start justify-between gap-1.5 p-1.5 bg-white border border-stone-200/90 hover:border-[#396252]/50 rounded-md shadow-2xs group transition"
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.2 bg-[#e4ede8] text-[#1f4a36] font-bold text-[10px] rounded shrink-0">
                          {mat.element}
                        </span>
                        {mat.category && (
                          <span className="px-1 py-0.1 bg-stone-100 text-stone-500 text-[8.5px] rounded border border-stone-200/60 font-semibold shrink-0">
                            {mat.category}
                          </span>
                        )}
                        <span className="text-[11px] text-stone-900 font-bold leading-snug break-words">
                          {mat.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => startEdit(mat)}
                        className="p-1 text-stone-400 hover:text-[#25543f] hover:bg-stone-100 rounded transition cursor-pointer"
                        title="Editar especificação"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(mat.id)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                        title="Apagar este item da cena"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
