import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, Plus, Trash2, Edit2, Check, X, ExternalLink, 
  RotateCw, Copy, Search, Maximize2, Minimize2, ZoomIn, 
  ZoomOut, Image as ImageIcon, Layers, Eye, CheckCircle2,
  Palette, Camera, Upload, Send, AlertCircle
} from 'lucide-react';
import { DetectedMaterial, BatchSceneItem } from '../types';
import { MdfCatalogModal, MdfItem } from './MdfCatalogModal';

export interface MaterialsEditorModalProps {
  materials: DetectedMaterial[];
  image: string | null;
  imageName?: string;
  onUpdateMaterial: (id: string, element: string, description: string) => void;
  onDeleteMaterial: (id: string) => void;
  onAddMaterial: (element: string, description: string, category?: string) => void;
  onClearMaterials: () => void;
  isDetecting: boolean;
  onDetectMaterials: (targetImg?: string) => void;
  onClose: () => void;
  onOpenExternalWindow?: () => void;
  isPopoutWindow?: boolean; 
  showToast?: (msg: string) => void;
  onReadSketchupScene?: () => void;
  // Suporte Unificado à Leitura em Lote (++)
  batchScenes?: BatchSceneItem[];
  onUpdateBatchScenes?: (scenes: BatchSceneItem[]) => void;
  onAddBatchFiles?: (files: FileList | File[]) => Promise<void>;
  onCaptureSkpForBatch?: () => void;
  onApplyBatchToChat?: (scenes: BatchSceneItem[], masterMaterialsText: string) => void;
  isInsideSketchup?: boolean;
  initialMode?: 'single' | 'batch';
  onSetMaterialsDirectly?: (materials: DetectedMaterial[]) => void;
}

const ARCHITECTURAL_PRESETS = [
  { label: 'Piso Principal', cat: 'Estrutural', desc: 'Porcelanato acetinado cinza claro 120x120cm com junta retificada de 1mm' },
  { label: 'Paredes & Painéis', cat: 'Estrutural', desc: 'Alvenaria com pintura mineral fosca neutra tom off-white suave' },
  { label: 'Forro / Teto', cat: 'Estrutural', desc: 'Gesso liso ultra-fosco com rasgos perimetrais de iluminação LED 3000K' },
  { label: 'Painel Ripado', cat: 'Marcenaria', desc: 'Lâmina natural amadeirada de Freijó ripado com veios orgânicos contínuos' },
  { label: 'Bancada & Ilha', cat: 'Marcenaria', desc: 'Mármore nobre polido com veios dourados e acabamento bisotado' },
  { label: 'Armários Freijó', cat: 'Marcenaria', desc: 'Marcenaria sob medida em lâmina de Freijó com puxadores usinados tipo cava' },
  { label: 'Armários Superiores', cat: 'Marcenaria', desc: 'Frentes em vidro reflecta bronze com perfis de alumínio fino e fita de LED interna' },
  { label: 'Sofá Modular', cat: 'Mobiliário', desc: 'Estofado em tecido linho cru encorpado com textura tátil e costura pespontada' },
  { label: 'Poltrona de Design', cat: 'Mobiliário', desc: 'Poltrona em couro natural tom conhaque com pés em madeira maciça' },
  { label: 'Mesa de Centro', cat: 'Mobiliário', desc: 'Tampo orgânico em madeira maciça e base esbelta em aço carbono preto fosco' },
  { label: 'Mesa de Jantar', cat: 'Mobiliário', desc: 'Tampo chanfrado em lâmina natural e cadeiras estofadas em bouclé' },
  { label: 'Tapete Central', cat: 'Têxteis', desc: 'Tear manual em fibras naturais com textura geométrica suave de baixo relevo' },
  { label: 'Cortinas', cat: 'Têxteis', desc: 'Gaze de linho fluida do teto ao piso com prega wave e caimento impecável' },
  { label: 'Esquadrias & Vidros', cat: 'Metais & Esquadrias', desc: 'Perfis de alumínio preto fosco microtexturizado com vidros incolores cristalinos' },
  { label: 'Metais & Torneira', cat: 'Metais & Esquadrias', desc: 'Monocomando gourmet em aço inox com acabamento preto fosco escovado' },
  { label: 'Pendentes de Iluminação', cat: 'Iluminação & Eletros', desc: 'Luminárias pendentes esculturais de design contemporâneo em metal preto e difusor âmbar' },
  { label: 'Eletrodomésticos', cat: 'Iluminação & Eletros', desc: 'Cooktop de indução em vitrocerâmica preta rente à bancada e forno inox' },
  { label: 'Objetos Decorativos', cat: 'Objetos & Decoração', desc: 'Vasos de cerâmica artesanal fosca, livros de arte abertos (coffee table) e louças de design' },
  { label: 'Vegetação & Biofilia', cat: 'Objetos & Decoração', desc: 'Cachepot contemporâneo com planta natural Ficus Lyrata de folhagem viçosa' },
  { label: 'Esculturas & Adornos', cat: 'Objetos & Decoração', desc: 'Escultura geométrica minimalista em pedra sabão e vela aromática em vidro âmbar' },
];

export const MaterialsEditorModal: React.FC<MaterialsEditorModalProps> = ({
  materials,
  image,
  imageName,
  onUpdateMaterial,
  onDeleteMaterial,
  onAddMaterial,
  onClearMaterials,
  isDetecting,
  onDetectMaterials,
  onClose,
  onOpenExternalWindow,
  isPopoutWindow = false, 
  showToast,
  onReadSketchupScene,
  batchScenes = [],
  onUpdateBatchScenes,
  onAddBatchFiles,
  onCaptureSkpForBatch,
  onApplyBatchToChat,
  isInsideSketchup = false,
  initialMode = 'single',
  onSetMaterialsDirectly,
}) => {
  const [viewMode, setViewMode] = useState<'single' | 'batch'>(initialMode);
  const [isBatchDetecting, setIsBatchDetecting] = useState<boolean>(false);
  const [selectedBatchSceneId, setSelectedBatchSceneId] = useState<string | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMode) {
      setViewMode(initialMode);
    }
  }, [initialMode]);

  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [internalImage, setInternalImage] = useState<string | null>(image);
  const [internalImageName, setInternalImageName] = useState<string | undefined>(imageName);

  useEffect(() => {
    if (image) {
      setInternalImage(image);
    }
  }, [image]);

  useEffect(() => {
    if (imageName) {
      setInternalImageName(imageName);
    }
  }, [imageName]);

  // Escuta novos prints capturados em tempo real mesmo com o modal aberto
  useEffect(() => {
    const handleCaptured = (e: any) => {
      if (e?.detail?.dataUrl) {
        setInternalImage(e.detail.dataUrl);
        const name = e.detail.is360 
          ? `Print_SketchUp_360_${e.detail.width || 2000}x${e.detail.height || 2500}.jpg`
          : `Print_SketchUp_${e.detail.width || 2000}x${e.detail.height || 2500}.jpg`;
        setInternalImageName(name);
      }
    };

    window.addEventListener('skp-image-captured', handleCaptured);

    // Registra callback direto invocado pelo SketchUp Ruby
    (window as any).atualizarPrintMateriais = (dataUrl: string, name?: string) => {
      if (dataUrl) {
        setInternalImage(dataUrl);
        if (name) setInternalImageName(name);
      }
    };

    // Solicita ao SketchUp Ruby o último print ativo
    if ((window as any).sketchup?.solicitar_print_materiais) {
      try {
        (window as any).sketchup.solicitar_print_materiais();
      } catch (_) {}
    }

    return () => {
      window.removeEventListener('skp-image-captured', handleCaptured);
    };
  }, []);

  const selectedBatchScene = batchScenes.find((s) => s.id === selectedBatchSceneId) || batchScenes[0];
  const activeBatchImage = selectedBatchScene?.image || null;
  const displayImage = viewMode === 'batch' ? (activeBatchImage || internalImage || image) : (internalImage || image);
  const displayName = viewMode === 'batch' 
    ? (selectedBatchScene ? `Cena ${selectedBatchScene.sceneCode} — ${selectedBatchScene.name || 'Lote'}` : 'Lote de Cenas (++)') 
    : (internalImageName || imageName || 'Print da Cena 3D SketchUp');

  // Redimensiona imagem para envio à IA sem estourar tempo limite
  const downscaleImageForVision = (dataUrl: string, maxDim = 1280, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (!width || !height) return resolve(dataUrl);
        if (width <= maxDim && height <= maxDim) return resolve(dataUrl);

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Métodos de gerenciamento do lote unificado de cenas
  const handleDetectBatchMaterials = async () => {
    if (!batchScenes || batchScenes.length === 0) {
      if (showToast) showToast('⚠️ Adicione ao menos 1 cena ao lote para leitura.');
      return;
    }

    setIsBatchDetecting(true);
    if (showToast) showToast(`⏳ Analisando e cruzando ${batchScenes.length} cena(s) do lote...`);

    try {
      const optimizedImages = await Promise.all(
        batchScenes.slice(0, 8).map(async (s) => {
          try {
            return await downscaleImageForVision(s.image, 1280, 0.8);
          } catch (_) {
            return s.image;
          }
        })
      );

      const res = await fetch('/api/detect-materials-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: optimizedImages,
          language: 'pt',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao processar materiais em lote.');
      }

      const data = await res.json();
      if (data && data.success && Array.isArray(data.materials)) {
        if (onSetMaterialsDirectly) {
          onSetMaterialsDirectly(data.materials);
        } else {
          onClearMaterials();
          data.materials.forEach((m: DetectedMaterial) => {
            onAddMaterial(m.element, m.description, m.category);
          });
        }
        if (showToast) showToast(`✓ ${data.materials.length} materiais em lote detectados com sucesso!`);
      } else {
        throw new Error('Nenhum material retornado pela IA.');
      }
    } catch (err: any) {
      console.error('[DETECT BATCH ERROR]', err);
      if (showToast) showToast(`⚠️ ${err.message || 'Falha na leitura em lote'}`);
    } finally {
      setIsBatchDetecting(false);
    }
  };

  const handleApplyBatchToChatClick = () => {
    if (!batchScenes || batchScenes.length === 0) {
      if (showToast) showToast('⚠️ O lote está vazio.');
      return;
    }
    const formattedPrompt = materials
      .map((m) => `• ${m.element}${m.category ? ` (${m.category})` : ''}: ${m.description}`)
      .join('\n');
    if (onApplyBatchToChat) {
      onApplyBatchToChat(batchScenes, formattedPrompt);
      if (showToast) showToast('✓ Cenas e materiais do lote enviados para o chat!');
      onClose();
    }
  };

  const handleRemoveBatchScene = (id: string) => {
    if (onUpdateBatchScenes && batchScenes) {
      const next = batchScenes.filter((s) => s.id !== id);
      onUpdateBatchScenes(next);
      if (showToast) showToast('Cena removida do lote.');
    }
  };

  const handleClearBatch = () => {
    if (onUpdateBatchScenes) {
      onUpdateBatchScenes([]);
      if (showToast) showToast('Lote de cenas limpo.');
    }
  };

  // Edit item states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editElement, setEditElement] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Add item states
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newElement, setNewElement] = useState('Objetos Decorativos');
  const [newCategory, setNewCategory] = useState('Objetos & Decoração');
  const [newDesc, setNewDesc] = useState('');

  // MDF Catalog states
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [targetMaterialId, setTargetMaterialId] = useState<string | null>(null);

  const handleApplyMdf = (item: MdfItem, spec: string) => {
    if (targetMaterialId) {
      const target = materials.find((m) => m.id === targetMaterialId);
      if (target) {
        onUpdateMaterial(target.id, target.element, spec);
      }
      setTargetMaterialId(null);
    } else {
      onAddMaterial(`Marcenaria (${item.name})`, spec, 'Marcenaria');
    }
    setIsCatalogOpen(false);
  };

  const openCatalogForMaterial = (id: string) => {
    setTargetMaterialId(id);
    setIsCatalogOpen(true);
  };

  // Categories list
  const categories = useMemo(() => {
    const defaultList = [
      'Todos',
      'Estrutural',
      'Marcenaria',
      'Metais & Esquadrias',
      'Mobiliário',
      'Têxteis',
      'Iluminação & Eletros',
      'Objetos & Decoração'
    ];
    // Adiciona categorias extras detectadas dinamicamente
    const dynamicSet = new Set<string>();
    materials.forEach((m) => {
      if (m.category && m.category.trim() && !defaultList.includes(m.category.trim())) {
        dynamicSet.add(m.category.trim());
      }
    });
    return [...defaultList, ...Array.from(dynamicSet)];
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCategory =
        selectedCategory === 'Todos' ||
        (m.category && m.category.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        (selectedCategory === 'Marcenaria' && /marcenaria|armário|armario|painel|bancada/i.test(m.element)) ||
        (selectedCategory === 'Estrutural' && /piso|parede|teto|forro|alvenaria/i.test(m.element)) ||
        (selectedCategory === 'Mobiliário' && /sofá|sofa|poltrona|mesa|cadeira|banqueta/i.test(m.element)) ||
        (selectedCategory === 'Têxteis' && /tapete|cortina|almofada|tecido/i.test(m.element)) ||
        (selectedCategory === 'Metais & Esquadrias' && /esquadria|metal|torneira|vidro|perfil/i.test(m.element)) ||
        (selectedCategory === 'Iluminação & Eletros' && /iluminação|pendente|luz|cooktop|forno|eletro/i.test(m.element)) ||
        (selectedCategory === 'Objetos & Decoração' && /objeto|vaso|livro|planta|vegetação|biofilia|decoração/i.test(m.element));

      const matchSearch =
        !searchFilter.trim() ||
        m.element.toLowerCase().includes(searchFilter.toLowerCase()) ||
        m.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(searchFilter.toLowerCase()));

      return matchCategory && matchSearch;
    });
  }, [materials, selectedCategory, searchFilter]);

  const startEdit = (mat: DetectedMaterial) => {
    setEditingId(mat.id);
    setEditElement(mat.element);
    setEditCategory(mat.category || 'Geral');
    setEditDesc(mat.description);
  };

  const saveEdit = () => {
    if (editingId && editElement.trim() && editDesc.trim()) {
      onUpdateMaterial(editingId, editElement.trim(), editDesc.trim());
      setEditingId(null);
    }
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (newElement.trim() && newDesc.trim()) {
      onAddMaterial(newElement.trim(), newDesc.trim(), newCategory.trim());
      setNewDesc('');
      setIsAddingOpen(false);
    }
  };

  const applyPreset = (preset: typeof ARCHITECTURAL_PRESETS[0]) => {
    setNewElement(preset.label);
    setNewCategory(preset.cat);
    setNewDesc(preset.desc);
    setIsAddingOpen(true);
  };

  // Copy full prompt
  const handleCopyFormattedPrompt = () => {
    if (!materials.length) return;
    const promptText = materials
      .map((m) => `[${m.element}${m.category ? ` - ${m.category}` : ''}]: ${m.description}`)
      .join('\n');

    navigator.clipboard.writeText(promptText).then(() => {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    });
  };

  // Broadcast sync channel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel('skp_render_pro_materials_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'FORCE_REFRESH') {
          // Atualiza caso outra janela tenha alterado
        }
      };
      return () => {
        channel.close();
      };
    } catch (e) {
      console.warn('BroadcastChannel não suportado neste contexto:', e);
    }
  }, []);

  // Atalho de teclado F5 ou Ctrl+R para recarga forçada no CEF do SketchUp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        handleHardReload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleHardReload = () => {
    try {
      if ((window as any).sketchup?.recarregar_dialogo_materiais) {
        (window as any).sketchup.recarregar_dialogo_materiais();
        return;
      }
    } catch (_) {}
    try {
      window.location.reload();
    } catch (_) {
      window.location.href = window.location.href;
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full min-w-full min-h-screen bg-[#f8faf9] m-0 p-0 text-stone-900 flex flex-col font-sans select-none overflow-hidden m-0 p-0">
      {/* HEADER PRINCIPAL - 100% INTEGRADO E SEM BORDAS VAZIAS */}
      <header className="px-3.5 py-2.5 bg-[#eef4f1] border-b border-[#396252]/20 flex flex-col gap-2 shrink-0 shadow-2xs">
        {/* Linha 1: Título, Seletor de Modo (Print Atual vs Lote ++) e Controles de Janela */}
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className={`w-4 h-4 text-[#25543f] shrink-0 ${(isDetecting || isBatchDetecting) ? 'animate-spin' : ''}`} />
            <span className="font-extrabold text-[12.5px] text-[#1c4432] tracking-wide whitespace-nowrap">
              MATERIAIS E OBJETOS DA CENA
            </span>
            {materials.length > 0 && (
              <span className="bg-[#25543f] text-white px-2 py-0.5 text-[10px] font-bold rounded-full shadow-2xs shrink-0">
                {materials.length} {materials.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>

          {/* Seletor de Modo Unificado: Print Atual vs Leitura em Lote (++) */}
          <div className="flex items-center bg-[#dbe8df] p-0.5 rounded-lg border border-[#2c5842]/30 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#25543f] text-white shadow-xs'
                  : 'text-[#1c4432] hover:bg-white/60'
              }`}
              title="Ler e editar materiais do Print da cena atual selecionada"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Print Atual</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('batch')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'batch'
                  ? 'bg-[#1c4432] text-white shadow-xs'
                  : 'text-[#1c4432] hover:bg-white/60'
              }`}
              title="Leitura em Lote (++) — Adicionar múltiplas cenas do mesmo ambiente para gerar materiais e iluminação 100% uniformes"
            >
              <span className="font-mono text-emerald-300 font-extrabold text-[12px] leading-none">++</span>
              <span>Leitura em Lote</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                viewMode === 'batch' ? 'bg-emerald-400 text-stone-900' : 'bg-[#25543f] text-white'
              }`}>
                {batchScenes.length}
              </span>
            </button>
          </div>

          {/* Controles da janela (Recarregar e Fechar) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleHardReload}
              className="p-1.5 text-stone-500 hover:text-[#25543f] hover:bg-stone-200/80 rounded-md transition cursor-pointer border border-stone-300/80 shadow-2xs"
              title="Recarregar Janela / Atualizar Cache (F5 ou Ctrl+R)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/80 rounded-md transition cursor-pointer border border-stone-300/80 shadow-2xs"
              title="Fechar esta janela e voltar ao chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linha 2: Barra de Ações dependente do modo selecionado */}
        {viewMode === 'single' ? (
          /* MODO SINGLE: Print Atual */
          <div className="flex items-center gap-1.5 flex-wrap">
            {displayImage && (
              <button
                type="button"
                onClick={() => setShowImagePanel(!showImagePanel)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 transition cursor-pointer border shadow-2xs shrink-0 ${
                  showImagePanel
                    ? 'bg-[#25543f] text-white border-[#25543f]'
                    : 'bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border-[#25543f]/30'
                }`}
                title="Exibir/Ocultar foto da cena 3D ao lado para comparar materiais com a imagem"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showImagePanel ? 'Ocultar Print' : 'Ver Print da Cena'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onReadSketchupScene) {
                  onReadSketchupScene();
                } else if ((window as any).sketchup?.solicitar_materiais_cena) {
                  (window as any).sketchup.solicitar_materiais_cena();
                }
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#142e22] hover:bg-[#1a3d2e] text-[#86efac] border border-[#34d399]/40 rounded flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 shrink-0"
              title="Lê instantaneamente todos os materiais reais e blocos 3D do seu modelo no SketchUp (sem depender de imagem)"
            >
              <Layers className="w-3.5 h-3.5 text-[#34d399]" />
              <span>Ler do SketchUp</span>
            </button>

            <button
              type="button"
              onClick={() => onDetectMaterials(displayImage || undefined)}
              disabled={isDetecting || !displayImage}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border border-[#25543f]/30 rounded flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95 shrink-0"
              title="Escanear e ler novamente toda a cena com a IA profunda a partir do print atual"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin text-[#25543f]' : ''}`} />
              <span>{isDetecting ? 'Analisando...' : 'Re-ler IA'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingOpen(!isAddingOpen)}
              className="px-3 py-1 text-[11px] font-bold bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Adicionar novo material ou objeto manualmente"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Item</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetMaterialId(null);
                setIsCatalogOpen(true);
              }}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#1c4432] hover:bg-[#153426] text-white rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0 border border-[#4ade80]/40"
              title="Navegar pelo catálogo com 316 padrões reais de MDF com texturas"
            >
              <Layers className="w-3.5 h-3.5 text-[#25543f]" />
              <span>Catálogo MDF</span>
              <span className="bg-[#25543f] text-white px-1.5 py-0.2 rounded-full text-[9px] font-bold">316</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFormattedPrompt}
              disabled={!materials.length}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border border-[#25543f]/30 rounded flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-40 shrink-0"
              title="Copiar lista de materiais formatada para a área de transferência"
            >
              {copiedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFeedback ? 'Copiado!' : 'Copiar Prompt'}</span>
            </button>

            {!isPopoutWindow && onOpenExternalWindow && (
              <button
                type="button"
                onClick={onOpenExternalWindow}
                className="px-2 py-1 text-[11px] font-bold bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border border-[#25543f]/30 rounded flex items-center gap-1 transition cursor-pointer shadow-2xs shrink-0"
                title="Abrir em Janela Separada do SketchUp"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Janela Externa</span>
              </button>
            )}

            {materials.length > 0 && (
              <button
                type="button"
                onClick={onClearMaterials}
                className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer shrink-0 ml-auto"
                title="Apagar todos os materiais detectados"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          /* MODO BATCH: Leitura em Lote (++) */
          <div className="flex flex-col gap-2 w-full">
            {/* Input oculto para adicionar fotos ao lote */}
            <input
              type="file"
              ref={batchFileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files && e.target.files.length > 0 && onAddBatchFiles) {
                  await onAddBatchFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />

            {/* Barra de Ações Rápidas do Lote */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Botão de Adicionar Cenas */}
              <button
                type="button"
                onClick={() => batchFileInputRef.current?.click()}
                className="px-2.5 py-1 text-[11px] font-bold bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
                title="Importar imagens de diferentes ângulos do mesmo ambiente"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>+ Adicionar Cenas</span>
              </button>

              {/* Botão de Captura do SketchUp para Lote */}
              {onCaptureSkpForBatch && (
                <button
                  type="button"
                  onClick={onCaptureSkpForBatch}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#142e22] hover:bg-[#1a3d2e] text-[#86efac] border border-[#34d399]/40 rounded flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95 shrink-0"
                  title="Captura a tela atual do SketchUp e adiciona ao lote (ex: A1, B2...)"
                >
                  <Camera className="w-3.5 h-3.5 text-[#34d399]" />
                  <span>Capturar do SketchUp</span>
                </button>
              )}

              {/* Botão Principal: Ler Materiais em Lote com IA */}
              <button
                type="button"
                onClick={handleDetectBatchMaterials}
                disabled={isBatchDetecting || batchScenes.length === 0}
                className="px-3 py-1 text-[11px] font-extrabold bg-[#1c4432] hover:bg-[#153426] text-[#4ade80] border border-[#4ade80]/50 rounded flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs active:scale-95 shrink-0"
                title="Analisa e cruza todas as cenas do lote para unificar 100% dos materiais e iluminação"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#4ade80] ${isBatchDetecting ? 'animate-spin' : ''}`} />
                <span>{isBatchDetecting ? 'Lendo Lote...' : '⚡ Ler Materiais em Lote com IA'}</span>
              </button>

              {/* Catálogo de MDF com Texturas */}
              <button
                type="button"
                onClick={() => {
                  setTargetMaterialId(null);
                  setIsCatalogOpen(true);
                }}
                className="px-2.5 py-1 text-[11px] font-bold bg-[#1c4432] hover:bg-[#153426] text-white rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0 border border-[#4ade80]/40"
                title="Navegar pelo catálogo com 316 padrões reais de MDF com texturas"
              >
                <Layers className="w-3.5 h-3.5 text-[#25543f]" />
                <span>Catálogo MDF</span>
                <span className="bg-[#25543f] text-white px-1.5 py-0.2 rounded-full text-[9px] font-bold">316</span>
              </button>

              {/* Subir Imagens e Prompts para o Chat */}
              {onApplyBatchToChat && (
                <button
                  type="button"
                  onClick={handleApplyBatchToChatClick}
                  disabled={batchScenes.length === 0}
                  className="px-3 py-1 text-[11px] font-black bg-[#25543f] hover:bg-[#1a3d2e] text-white border border-[#4ade80]/50 rounded flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="Subir todas as imagens e prompts gerados do lote direto para o chat"
                >
                  <Send className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>Subir Imagens para o Chat</span>
                </button>
              )}

              {/* Copiar Prompt */}
              <button
                type="button"
                onClick={handleCopyFormattedPrompt}
                disabled={!materials.length}
                className="px-2 py-1 text-[11px] font-bold bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border border-[#25543f]/30 rounded flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-40 shrink-0"
                title="Copiar lista de materiais unificados formatada"
              >
                {copiedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFeedback ? 'Copiado!' : 'Copiar Prompt'}</span>
              </button>

              {/* Limpar Lote */}
              {batchScenes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearBatch}
                  className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer shrink-0 ml-auto"
                  title="Limpar todas as cenas do lote"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Carrossel de Cenas do Lote */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 bg-[#e2ece6] rounded-md border border-[#2c5842]/20 scrollbar-thin">
              {batchScenes.length === 0 ? (
                <div className="flex items-center gap-2 py-1 px-2 text-[11px] text-stone-600 font-medium w-full justify-between">
                  <span>Nenhuma cena no lote ainda. Clique em <b>+ Adicionar Cenas</b> ou <b>Capturar do SketchUp</b> para ler materiais em lote.</span>
                </div>
              ) : (
                batchScenes.map((scene, idx) => (
                  <div
                    key={scene.id}
                    onClick={() => {
                      setSelectedBatchSceneId(scene.id);
                      setShowImagePanel(true);
                    }}
                    className={`relative flex items-center gap-1.5 p-1 rounded border transition cursor-pointer shrink-0 ${
                      (selectedBatchSceneId === scene.id || (!selectedBatchSceneId && idx === 0))
                        ? 'bg-white border-[#25543f] shadow-xs'
                        : 'bg-[#f0f6f2] hover:bg-white border-stone-300'
                    }`}
                    title={`Clique para conferir cena ${scene.sceneCode}`}
                  >
                    <img
                      src={scene.image}
                      alt={scene.name}
                      className="w-10 h-10 object-cover rounded border border-stone-200 shrink-0"
                    />
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="font-mono font-extrabold text-[#1c4432] text-[11px] leading-tight">
                        {scene.sceneCode || `Cena ${idx + 1}`}
                      </span>
                      <span className="text-[9.5px] text-stone-600 truncate max-w-[80px]">
                        {scene.name || `Cena ${idx + 1}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBatchScene(scene.id);
                      }}
                      className="p-0.5 text-stone-400 hover:text-red-600 hover:bg-stone-200 rounded transition cursor-pointer"
                      title="Remover esta cena do lote"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </header>

      {/* ÁREA PRINCIPAL: DIVISÃO EM COLUNAS (OPCIONAL: PRINT 3D À ESQUERDA + GRADE DE MATERIAIS) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Painel lateral opcional do Print da Cena com Zoom */}
        {showImagePanel && (
          <aside className="md:w-5/12 lg:w-4/12 bg-[#0d1712] border-b md:border-b-0 md:border-r border-[#244534] flex flex-col shrink-0 overflow-hidden relative max-h-[45vh] md:max-h-full">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#14261d] border-b border-[#244534] text-xs">
              <div className="flex items-center gap-1.5 text-stone-300 font-semibold text-[11px]">
                <ImageIcon className="w-3.5 h-3.5 text-[#4ade80]" />
                <span className="truncate max-w-[200px]">{displayName || 'Print da Cena 3D SketchUp'}</span>
              </div>
              <div className="flex items-center gap-1 text-stone-400">
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] w-8 text-center font-mono text-stone-300">{Math.round(imageZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setImageZoom((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 hover:text-white rounded hover:bg-white/10 transition"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="px-1.5 py-0.5 text-[9.5px] hover:text-white rounded hover:bg-white/10 font-mono transition text-stone-300"
                  title="Ajustar 100%"
                >
                  1:1
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-3 bg-black/40 relative">
              {displayImage ? (
                <div 
                  className="transition-transform duration-150 origin-center flex items-center justify-center max-w-full max-h-full"
                  style={{ transform: `scale(${imageZoom})` }}
                >
                  <img
                    src={displayImage}
                    alt="Referência da Cena 3D"
                    className="max-w-full max-h-[75vh] object-contain rounded shadow-2xl border border-stone-800"
                  />
                </div>
              ) : (
                <div className="text-center p-6 text-stone-500 flex flex-col items-center gap-2">
                  <ImageIcon className="w-10 h-10 stroke-1 text-stone-600" />
                  <p className="text-xs">Nenhum print anexado no momento.</p>
                </div>
              )}
            </div>

            <div className="p-2 bg-[#14261d] border-t border-[#244534] text-[10.5px] text-[#9aaea3] flex items-center justify-between">
              <span>🎯 Compare cada material à direita com a geometria do modelo</span>
              <button
                type="button"
                onClick={() => setShowImagePanel(false)}
                className="text-stone-400 hover:text-stone-200 text-[10px] underline"
              >
                Ocultar foto
              </button>
            </div>
          </aside>
        )}

        {/* WORKSPACE PRINCIPAL: FILTROS + GRADE DE CARDS CLARA */}
        <main className="flex-1 flex flex-col bg-[#f8faf9] overflow-hidden">
          {/* BARRA DE FILTROS E BUSCA */}
          <div className="px-3.5 py-2 bg-white border-b border-[#396252]/15 flex items-center justify-between gap-3 flex-wrap shrink-0">
            {/* Chips de Categorias Horizontais com scrollbar oculta */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto py-1 w-full no-scrollbar flex-1 min-w-[260px]"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#25543f] text-white shadow-2xs font-bold'
                      : 'bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar item..."
                style={{ paddingLeft: '32px' }}
                className="w-full !pl-8 pr-6 py-1.5 text-[11.5px] bg-[#fbfdfc] border border-stone-300 focus:border-[#25543f] rounded-md outline-none text-stone-800 placeholder:text-stone-400 transition"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* FORMULÁRIO RÁPIDO PARA ADICIONAR NOVO ITEM */}
          {isAddingOpen && (
            <form onSubmit={handleAddNew} className="m-3 p-3 bg-white border border-[#25543f]/40 rounded-lg shadow-sm space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-[#1c4432] flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#25543f]" /> Adicionar Novo Material ou Objeto à Cena
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingOpen(false)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sugestões Rápidas de Presets de Arquitetura */}
              <div className="p-2 bg-[#f4f8f6] rounded border border-[#25543f]/20 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {ARCHITECTURAL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      newElement === p.label
                        ? 'bg-[#25543f] text-white'
                        : 'bg-white text-[#1c4432] hover:bg-[#e4ede8] border border-[#25543f]/20'
                    }`}
                  >
                    + {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Elemento ou Objeto:</label>
                  <input
                    type="text"
                    value={newElement}
                    onChange={(e) => setNewElement(e.target.value)}
                    placeholder="Ex: Bancada da Ilha"
                    className="w-full p-1.5 text-xs font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Categoria:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-1.5 text-xs font-semibold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f] bg-white"
                  >
                    {categories.filter((c) => c !== 'Todos').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Especificação PBR / Acabamento:</label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ex: Mármore Branco Paraná polido com veios contínuos"
                    className="w-full p-1.5 text-xs font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsAddingOpen(false)}
                  className="px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-xs font-bold rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Adicionar à Lista</span>
                </button>
              </div>
            </form>
          )}

          {/* LISTA DE CARDS - EXATAMENTE A GRADE DE 2 COLUNAS DO PRINT DO USUÁRIO */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            {filteredMaterials.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-stone-500">
                <div className="w-12 h-12 rounded-full bg-[#eef4f1] border border-[#25543f]/20 flex items-center justify-center mb-3 shadow-2xs">
                  <Sparkles className="w-6 h-6 text-[#25543f]" />
                </div>
                <p className="text-sm font-bold text-stone-800">
                  {materials.length === 0
                    ? 'Nenhum material ou objeto detectado ainda nesta cena.'
                    : 'Nenhum item corresponde ao filtro selecionado.'}
                </p>
                <p className="text-xs text-stone-500 max-w-md mt-1 leading-relaxed">
                  {materials.length === 0
                    ? 'Clique no botão "Re-ler" acima para a IA varrer a cena ou adicione itens manualmente pelo botão "+ Novo Item".'
                    : 'Selecione a aba "Todos" ou limpe a caixa de pesquisa para exibir todos os itens.'}
                </p>
                {materials.length === 0 && (
                  <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (onReadSketchupScene) {
                          onReadSketchupScene();
                        } else if ((window as any).sketchup?.solicitar_materiais_cena) {
                          (window as any).sketchup.solicitar_materiais_cena();
                        }
                      }}
                      className="px-4 py-2 bg-[#142e22] hover:bg-[#1a3d2e] text-[#86efac] border border-[#34d399]/40 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer active:scale-95"
                      title="Lê os materiais e componentes 3D diretamente do SketchUp"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Ler do Modelo 3D (SketchUp)</span>
                    </button>
                    {displayImage && (
                      <button
                        type="button"
                        onClick={() => onDetectMaterials(displayImage || undefined)}
                        disabled={isDetecting}
                        className="px-4 py-2 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                        <span>{isDetecting ? 'Analisando Cena 3D...' : 'Analisar Print com IA'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddingOpen(true)}
                      className="px-3.5 py-2 bg-white hover:bg-stone-50 text-[#1c4432] border border-[#25543f]/30 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Manualmente</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredMaterials.map((mat) => {
                  const isEditing = editingId === mat.id;

                  if (isEditing) {
                    return (
                      <div
                        key={mat.id}
                        className="p-2.5 bg-white border-2 border-[#25543f] rounded-lg shadow-sm space-y-2 col-span-1 md:col-span-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Elemento / Objeto:</label>
                            <input
                              type="text"
                              value={editElement}
                              onChange={(e) => setEditElement(e.target.value)}
                              className="w-full p-1.5 text-xs font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                            />
                          </div>

                          <div className="sm:col-span-8">
                            <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Especificação Técnica PBR:</label>
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full p-1.5 text-xs font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#25543f]"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-xs text-stone-500 hover:bg-stone-100 rounded"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="px-3 py-1 bg-[#25543f] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Salvar Alteração
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={mat.id}
                      className="flex items-start justify-between gap-2 p-2.5 bg-white border border-[#dce7e1] hover:border-[#25543f]/60 rounded-lg shadow-2xs group transition"
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          {mat.element ? (
                            <span className="px-2 py-0.5 bg-[#e4ede8] text-[#1c4432] font-extrabold text-[11.5px] rounded shrink-0 border border-[#25543f]/20">
                              {mat.element}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-[#e4ede8] text-[#1c4432] font-extrabold text-[11.5px] rounded shrink-0 border border-[#25543f]/20">
                              Material
                            </span>
                          )}
                          {mat.category && (
                            <span className="px-1.5 py-0.5 bg-stone-100 text-stone-700 text-[10px] rounded border border-stone-200/80 font-bold shrink-0">
                              {mat.category}
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] text-stone-900 font-bold leading-snug break-words tracking-tight">
                          {mat.description}
                        </p>
                      </div>

                      {/* Ações do Card: Escolher MDF, Editar, Salvar e Excluir */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition pt-0.5">
                        <button
                          type="button"
                          onClick={() => openCatalogForMaterial(mat.id)}
                          className="p-1 text-stone-500 hover:text-[#25543f] hover:bg-stone-100 rounded transition cursor-pointer"
                          title="Escolher padrão de MDF do catálogo para este item"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(mat)}
                          className="px-2 py-0.5 text-[11px] font-bold bg-[#e4ede8] hover:bg-[#1c4432] text-[#1c4432] hover:text-white rounded transition cursor-pointer flex items-center gap-1 border border-[#25543f]/20 shadow-2xs"
                          title="Editar especificação deste item"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (showToast) showToast(`✓ Material "${mat.element}" salvo com sucesso!`);
                          }}
                          className="px-2 py-0.5 text-[11px] font-bold bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded transition cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Salvar material"
                        >
                          <Check className="w-3 h-3 text-emerald-300" />
                          <span>Salvar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMaterial(mat.id)}
                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                          title="Remover este item da lista"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RODAPÉ DE SINCRONIZAÇÃO EM TEMPO REAL */}
          <footer className="px-3.5 py-2.5 bg-[#eef4f1] border-t border-[#396252]/20 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
            <div className="flex items-center gap-2 text-stone-600 text-[11px] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sincronizado automaticamente com o painel do SketchUp e com a caixa de texto do chat.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyFormattedPrompt}
                className="px-3 py-1.5 bg-[#e4ede8] hover:bg-[#d5e4dc] text-[#1c4432] border border-[#25543f]/30 rounded font-bold transition flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Prompt Formatado</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded font-bold transition flex items-center gap-1.5 cursor-pointer text-xs shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Concluir e Voltar ao Chat</span>
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* MODAL DO CATÁLOGO DE MDF BRASILEIRO (316 PADRÕES COM TEXTURAS) */}
      <MdfCatalogModal showToast={showToast}
        isOpen={isCatalogOpen}
        onClose={() => {
          setIsCatalogOpen(false);
          setTargetMaterialId(null);
        }}
        onSelectMdf={handleApplyMdf}
        targetMaterialName={
          targetMaterialId
            ? materials.find((m) => m.id === targetMaterialId)?.element || 'Material'
            : null
        }
      />
    </div>
  );
};