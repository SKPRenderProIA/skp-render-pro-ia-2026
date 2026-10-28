import React, { useState, useMemo } from 'react';
import { Search, X, Check, Layers, Sparkles } from 'lucide-react';
import mdfCatalogData from '../data/mdf_catalog.json';

export interface MdfItem {
  id: string;
  brand: string;
  name: string;
  category: string;
  hexColor: string;
  rgb: number[];
  roughness: number;
  specular: number;
  textureFile?: string;
  localTexture?: string;
}

const MDF_ITEMS: MdfItem[] = mdfCatalogData as MdfItem[];

interface MdfCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMdf: (item: MdfItem, spec: string) => void;
  targetMaterialName?: string | null;
  showToast?: (msg: string) => void;
}

export const MdfCatalogModal: React.FC<MdfCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectMdf,
  targetMaterialName,
  showToast,
}) => {
  const [selectedBrand, setSelectedBrand] = useState<string>('Todas');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const brands = useMemo(() => {
    const set = new Set<string>();
    MDF_ITEMS.forEach((item) => {
      if (item.brand) set.add(item.brand);
    });
    return ['Todas', ...Array.from(set)];
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    MDF_ITEMS.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['Todas', ...Array.from(set)];
  }, []);

  const filteredItems = useMemo(() => {
    return MDF_ITEMS.filter((item) => {
      const matchBrand = selectedBrand === 'Todas' || item.brand === selectedBrand;
      const matchCat = selectedCategory === 'Todas' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q));
      return matchBrand && matchCat && matchQ;
    });
  }, [selectedBrand, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleChoose = (item: MdfItem) => {
    const spec = `MDF padrão ${item.name} (${item.brand}) com acabamento acetinado com veios autênticos, textura realista de alta definição, Roughness ~${item.roughness.toFixed(2)}, reflexão física PBR controlada`;
    onSelectMdf(item, spec);
    if (showToast) {
      showToast(`✓ MDF ${item.name} (${item.brand}) aplicado com sucesso!`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#eef4f1] border-b border-[#25543f]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#25543f] text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1c4432] flex items-center gap-2">
                <span>Catálogo Oficial de MDF Brasileiro</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#25543f] text-white font-bold">
                  {MDF_ITEMS.length} padrões reais
                </span>
              </h2>
              <p className="text-[11px] text-stone-600">
                {targetMaterialName
                  ? `Substituindo acabamento de: "${targetMaterialName}"`
                  : 'Selecione um padrão para adicionar como material de marcenaria'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200/80 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            {/* Filtro Fabricante */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {brands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                    selectedBrand === brand
                      ? 'bg-[#25543f] text-white font-bold shadow-2xs'
                      : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* Filtro Tipologia */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 text-[11px] font-medium bg-white border border-stone-300 rounded-md outline-none text-stone-800"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar padrão de MDF..."
              className="w-full pl-8 pr-6 py-1.5 text-xs bg-white border border-stone-300 focus:border-[#25543f] rounded-lg outline-none text-stone-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Grade de Padrões */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#f8faf9]">
          {filteredItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-stone-500">
              <Layers className="w-8 h-8 text-stone-400 mb-2" />
              <p className="text-xs font-bold text-stone-700">Nenhum MDF corresponde ao filtro.</p>
              <p className="text-[11px] text-stone-500 mt-0.5">Tente limpar a pesquisa ou selecionar outro fabricante.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChoose(item)}
                  className="group flex flex-col bg-white border border-stone-200 hover:border-[#25543f] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition text-left cursor-pointer p-2 relative"
                >
                  {/* Swatch de Cor / Textura */}
                  <div
                    className="w-full h-24 rounded-lg mb-2 border border-stone-200 overflow-hidden relative flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: item.hexColor || '#d4cbbe' }}
                  >
                    {item.localTexture ? (
                      <img
                        src={item.localTexture}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                        onError={(e) => {
                          // Se falhar o carregamento da imagem local, esconde e mantém a cor sólida
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
                      {item.brand}
                    </span>
                    <h3 className="text-xs font-extrabold text-stone-900 truncate group-hover:text-[#25543f] transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-[10px] text-stone-500 truncate mt-0.5">
                      {item.category}
                    </p>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-500 font-medium">
                    <span className="font-mono text-[9px]">{item.hexColor}</span>
                    <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Usar <Check className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
          <span>
            Exibindo <strong>{filteredItems.length}</strong> de {MDF_ITEMS.length} padrões cadastrados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-stone-200 text-stone-700 font-bold border border-stone-300 rounded-lg transition cursor-pointer text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
