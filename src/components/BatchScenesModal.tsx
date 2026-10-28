import React, { useState, useRef } from 'react';
import { BatchSceneItem, DetectedMaterial } from '../types';
import { Language, translations } from '../locales';
import { 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  Sparkles, 
  Copy, 
  Check, 
  Camera, 
  Upload, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  RotateCw,
  Edit2,
  Search,
  Filter
} from 'lucide-react';

interface BatchScenesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: BatchSceneItem[];
  onUpdateScenes: (scenes: BatchSceneItem[]) => void;
  onAddFiles: (files: FileList | File[]) => Promise<void>;
  onCaptureSkpView?: () => void;
  language: Language;
  showToast: (msg: string) => void;
  onApplyBatchToChat?: (scenes: BatchSceneItem[], unifiedMaterialsText: string) => void;
  isInsideSketchup?: boolean;
}

const AVAILABLE_CODES = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10', 'L11', 'M12', 'N13', 'O14', 'P15'];

export const BatchScenesModal: React.FC<BatchScenesModalProps> = ({
  isOpen,
  onClose,
  scenes,
  onUpdateScenes,
  onAddFiles,
  onCaptureSkpView,
  language,
  showToast,
  onApplyBatchToChat,
  isInsideSketchup = false,
}) => {
  const [environmentName, setEnvironmentName] = useState<string>('Living Integrado e Sala de Estar');
  const [environmentNotes, setEnvironmentNotes] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState<boolean>(false);
  const [detectedMaterials, setDetectedMaterials] = useState<DetectedMaterial[]>([]);
  const [materialsSummaryText, setMaterialsSummaryText] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSceneImageId, setCopiedSceneImageId] = useState<string | null>(null);
  const [savedMaterialId, setSavedMaterialId] = useState<string | null>(null);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenes' | 'materials' | 'prompts'>('scenes');

  // Estado para Edição de Material Individual no Lote
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editElement, setEditElement] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Geral');
  const [editDescription, setEditDescription] = useState<string>('');

  // Adicionar novo material manualmente
  const [isAddingMaterial, setIsAddingMaterial] = useState<boolean>(false);
  const [newElement, setNewElement] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Estrutural');
  const [newDescription, setNewDescription] = useState<string>('');

  // Busca e filtro por categoria nos materiais do lote
  const [materialSearch, setMaterialSearch] = useState<string>('');
  const [selectedMaterialCategory, setSelectedMaterialCategory] = useState<string>('Todos');

  // Formata o resumo mestre de materiais
  const formatMaterialsSummary = (mats: DetectedMaterial[]) => {
    return mats
      .map((m) => `[${m.element}${m.category && m.category !== 'Geral' ? ` - ${m.category}` : ''}]: ${m.description}`)
      .join('\n\n');
  };

  const handleStartEditMaterial = (mat: DetectedMaterial) => {
    setEditingMaterialId(mat.id);
    setEditElement(mat.element);
    setEditCategory(mat.category || 'Geral');
    setEditDescription(mat.description);
  };

  const handleSaveEditMaterial = (id: string) => {
    if (!editElement.trim()) {
      showToast('⚠️ O nome do elemento/objeto não pode ficar vazio.');
      return;
    }
    if (!editDescription.trim()) {
      showToast('⚠️ A especificação técnica PBR não pode ficar vazia.');
      return;
    }

    const updated = detectedMaterials.map((m) =>
      m.id === id
        ? {
            ...m,
            element: editElement.trim(),
            category: editCategory.trim() || 'Geral',
            description: editDescription.trim(),
          }
        : m
    );

    setDetectedMaterials(updated);
    setMaterialsSummaryText(formatMaterialsSummary(updated));
    setEditingMaterialId(null);
    showToast('✓ Material salvo com sucesso!');
  };

  const handleCancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditElement('');
    setEditCategory('Geral');
    setEditDescription('');
  };

  // Salvar rápido individual de material diretamente na lista
  const handleQuickSaveMaterial = (mat: DetectedMaterial) => {
    setSavedMaterialId(mat.id);
    setTimeout(() => setSavedMaterialId(null), 2000);
    showToast(`✓ Material "${mat.element}" salvo e travado no lote!`);
  };

  // Copiar imagem da cena do lote para a área de transferência
  const handleCopySceneImage = async (scene: BatchSceneItem) => {
    try {
      const imageUrl = scene.image;
      let copiedAsBlob = false;

      // 1. Tenta copiar como Blob de imagem PNG (compatível com colagem direta em mensageiros e editores)
      if (typeof window !== 'undefined' && 'clipboard' in navigator && (window as any).ClipboardItem) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Falha ao carregar imagem para cópia'));
            img.src = imageUrl;
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob((b) => resolve(b), 'image/png')
            );
            if (blob) {
              const clipboardItem = new (window as any).ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([clipboardItem]);
              copiedAsBlob = true;
            }
          }
        } catch (blobErr) {
          console.warn('Fallback para cópia de texto da imagem:', blobErr);
        }
      }

      // 2. Fallback: copia a URL ou base64 como texto na área de transferência
      if (!copiedAsBlob && navigator.clipboard) {
        await navigator.clipboard.writeText(imageUrl);
      }

      setCopiedSceneImageId(scene.id);
      setTimeout(() => setCopiedSceneImageId(null), 2500);
      showToast(`✓ Imagem do print ${scene.sceneCode || ''} copiada com sucesso!`);
    } catch (err) {
      console.error('Erro ao copiar imagem:', err);
      showToast('⚠️ Não foi possível copiar a imagem diretamente.');
    }
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = detectedMaterials.filter((m) => m.id !== id);
    setDetectedMaterials(updated);
    setMaterialsSummaryText(formatMaterialsSummary(updated));
    showToast('Material removido do lote.');
  };

  const handleAddNewMaterial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newElement.trim() || !newDescription.trim()) {
      showToast('⚠️ Preencha o elemento e a descrição técnica PBR.');
      return;
    }

    const newMat: DetectedMaterial = {
      id: `batch-mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      element: newElement.trim(),
      category: newCategory.trim() || 'Geral',
      description: newDescription.trim(),
    };

    const updated = [...detectedMaterials, newMat];
    setDetectedMaterials(updated);
    setMaterialsSummaryText(formatMaterialsSummary(updated));
    setNewElement('');
    setNewDescription('');
    setIsAddingMaterial(false);
    showToast('✓ Novo material adicionado ao lote!');
  };

  const handleCopyAllMaterials = () => {
    if (detectedMaterials.length === 0) {
      showToast('⚠️ Nenhum material unificado para copiar.');
      return;
    }
    const fullText = formatMaterialsSummary(detectedMaterials);
    handleCopy(fullText, 'all-materials', 'Lista de materiais unificados copiada!');
  };

  const filteredMaterials = detectedMaterials.filter((mat) => {
    const term = materialSearch.toLowerCase().trim();
    const matchSearch =
      !term ||
      mat.element.toLowerCase().includes(term) ||
      mat.description.toLowerCase().includes(term) ||
      (mat.category && mat.category.toLowerCase().includes(term));

    const matchCategory =
      selectedMaterialCategory === 'Todos' ||
      (mat.category && mat.category.toLowerCase().includes(selectedMaterialCategory.toLowerCase())) ||
      (selectedMaterialCategory === 'Marcenaria' && /marcenaria|armário|armario|painel|bancada|freijó|mdf|gaveta/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Estrutural' && /piso|parede|teto|forro|alvenaria|concreto|tijol/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Mobiliário' && /sofá|sofa|poltrona|mesa|cadeira|banqueta|ilha|rack/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Têxteis' && /tapete|cortina|almofada|tecido|linho/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Metais & Esquadrias' && /esquadria|metal|torneira|vidro|perfil|aço|inox|ferro/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Iluminação & Eletros' && /iluminação|pendente|luz|cooktop|forno|eletro|geladeira|coifa|led/i.test(mat.element)) ||
      (selectedMaterialCategory === 'Objetos & Decoração' && /objeto|vaso|livro|planta|vegetação|biofilia|decoração/i.test(mat.element));

    return matchSearch && matchCategory;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redimensiona/comprime imagem para envio à IA sem estourar limites de payload ou tempo
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

  if (!isOpen) return null;

  const t = translations[language];

  // Helper de cópia
  const handleCopy = async (text: string, id: string, feedback = 'Copiado!') => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(`✓ ${feedback}`);
    } catch (_) {
      showToast('⚠️ Erro ao copiar texto.');
    }
  };

  // Remover cena individual
  const handleRemoveScene = (id: string) => {
    const next = scenes.filter((s) => s.id !== id);
    onUpdateScenes(next);
    showToast('Cena removida do lote.');
  };

  // Alterar código da cena (A1, B2, C3...)
  const handleChangeCode = (id: string, newCode: string) => {
    const next = scenes.map((s) => (s.id === id ? { ...s, sceneCode: newCode } : s));
    onUpdateScenes(next);
  };

  // Alterar nota individual da cena
  const handleChangeSceneNote = (id: string, note: string) => {
    const next = scenes.map((s) => (s.id === id ? { ...s, customNote: note } : s));
    onUpdateScenes(next);
  };

  // Limpar todas as cenas
  const handleClearAll = () => {
    if (scenes.length === 0) return;
    onUpdateScenes([]);
    setDetectedMaterials([]);
    setMaterialsSummaryText('');
    showToast('Lote de cenas limpo.');
  };

  // Disparar leitura unificada de materiais em lote
  const handleDetectBatchMaterials = async () => {
    if (scenes.length === 0) {
      showToast('⚠️ Adicione ao menos 1 cena ao lote para leitura.');
      return;
    }

    setIsDetecting(true);
    showToast(`⏳ Analisando e cruzando ${scenes.length} cena(s) do mesmo ambiente...`);

    try {
      // Otimiza e comprime levemente as imagens do lote para envio ultrarrápido à IA (evita payload gigantesco e timeout)
      const optimizedImages = await Promise.all(
        scenes.slice(0, 8).map(async (s) => {
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
          language,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao processar materiais em lote.');
      }

      const data = await res.json();
      if (data && data.success && Array.isArray(data.materials)) {
        setDetectedMaterials(data.materials);
        setMaterialsSummaryText(data.formattedText || '');
        setActiveTab('materials');
        showToast(`✓ ${data.materials.length} materiais unificados detectados em todo o ambiente!`);
      } else {
        throw new Error('Nenhum material retornado pela IA.');
      }
    } catch (err: any) {
      console.error('[DETECT BATCH ERROR]', err);
      showToast(`⚠️ ${err.message || 'Falha na leitura em lote'}`);
    } finally {
      setIsDetecting(false);
    }
  };

  // Disparar geração de Super Prompts Uniformes para cada cena do lote
  const handleGenerateBatchPrompts = async () => {
    if (scenes.length === 0) {
      showToast('⚠️ Adicione ao menos 1 cena para gerar prompts.');
      return;
    }

    setIsGeneratingPrompts(true);
    showToast(`✨ Gerando ${scenes.length} Super Prompts uniformes para o lote...`);

    try {
      const payloadScenes = scenes.map((s, idx) => ({
        id: s.id,
        sceneCode: s.sceneCode || AVAILABLE_CODES[idx % AVAILABLE_CODES.length] || `A${idx + 1}`,
        image: s.image,
        width: s.width || 2000,
        height: s.height || 2500,
        customNote: s.customNote || environmentNotes || '',
      }));

      const res = await fetch('/api/batch-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: payloadScenes,
          unifiedMaterials: detectedMaterials,
          language,
          environmentInstruction: `${environmentName ? `Ambiente: ${environmentName}. ` : ''}${environmentNotes}`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao gerar prompts em lote.');
      }

      const data = await res.json();
      if (data && data.success && Array.isArray(data.results)) {
        const updatedScenes = scenes.map((s) => {
          const matchedResult = data.results.find((r: any) => r.id === s.id || r.sceneCode === s.sceneCode);
          if (matchedResult) {
            return {
              ...s,
              generatedPrompt: matchedResult.masterPrompt || matchedResult.renderPromptPt || '',
            };
          }
          return s;
        });

        onUpdateScenes(updatedScenes);
        setActiveTab('prompts');
        if (updatedScenes[0]) {
          setExpandedSceneId(updatedScenes[0].id);
        }
        showToast(`✓ ${data.results.length} Super Prompts gerados com materiais 100% consistentes!`);
      } else {
        throw new Error('Nenhum resultado retornado pelo gerador de lote.');
      }
    } catch (err: any) {
      console.error('[BATCH PROMPTS ERROR]', err);
      showToast(`⚠️ ${err.message || 'Falha ao gerar prompts'}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Copiar todos os prompts do lote de uma só vez
  const handleCopyAllPrompts = () => {
    const validPrompts = scenes
      .filter((s) => s.generatedPrompt && s.generatedPrompt.trim().length > 0)
      .map((s) => s.generatedPrompt!.trim());

    if (validPrompts.length === 0) {
      showToast('⚠️ Nenhum prompt gerado ainda para copiar.');
      return;
    }

    const joinedText = validPrompts.join('\n\n---\n\n');
    handleCopy(joinedText, 'all-prompts', 'Todos os prompts do lote copiados!');
  };

  // Enviar para o chat do plugin
  const handleSendToChat = () => {
    if (onApplyBatchToChat) {
      onApplyBatchToChat(scenes, materialsSummaryText);
      onClose();
      showToast('✓ Lote de cenas adicionado ao chat do plugin!');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#f8faf9] border border-stone-300 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#113222] text-white border-b border-[#2c5842] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1c4432] border border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] font-extrabold text-sm shadow-inner">
              ++
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                <span>Leitura e Geração em Lote de Cenas</span>
                <span className="text-[10px] bg-[#4ade80]/20 text-[#4ade80] px-2 py-0.5 rounded-full font-bold border border-[#4ade80]/30 uppercase">
                  Mesmo Ambiente
                </span>
              </h2>
              <p className="text-[11px] text-stone-300 font-normal leading-tight">
                Garante que piso, paredes, marcenaria MDF, forro e iluminação fiquem 100% idênticos e uniformes em todos os ângulos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            title="Fechar janela de lote"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO ENTRE ABAS */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-stone-200 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('scenes')}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'scenes'
                  ? 'bg-[#1c4432] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>1. Cenas do Lote ({scenes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('materials')}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'materials'
                  ? 'bg-[#1c4432] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4ade80]" />
              <span>2. Materiais Unificados {detectedMaterials.length > 0 && `(${detectedMaterials.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('prompts')}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'prompts'
                  ? 'bg-[#1c4432] text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>3. Super Prompts ({scenes.filter((s) => Boolean(s.generatedPrompt)).length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {scenes.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] text-stone-500 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer transition"
                title="Limpar todas as cenas do lote"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Limpar Lote</span>
              </button>
            )}
          </div>
        </div>

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* CONFIGURAÇÃO DO AMBIENTE (SEMPRE VISÍVEL) */}
          <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                  Nome do Ambiente / Cômodo
                </label>
                <input
                  type="text"
                  value={environmentName}
                  onChange={(e) => setEnvironmentName(e.target.value)}
                  placeholder="Ex: Living Integrado com Sala de Jantar"
                  className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded focus:border-[#1c4432] focus:ring-1 focus:ring-[#1c4432] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wide mb-1">
                  Instrução Global de Estilo / Iluminação (Opcional)
                </label>
                <input
                  type="text"
                  value={environmentNotes}
                  onChange={(e) => setEnvironmentNotes(e.target.value)}
                  placeholder="Ex: Luz natural da tarde 15h, marcenaria Freijó Puro e laca cinza fosca"
                  className="w-full text-xs px-2.5 py-1.5 border border-stone-300 rounded focus:border-[#1c4432] focus:ring-1 focus:ring-[#1c4432] outline-none"
                />
              </div>
            </div>
          </div>

          {/* TAB 1: CENAS DO LOTE */}
          {activeTab === 'scenes' && (
            <div className="space-y-3">
              {/* BARRA DE AÇÕES PARA ADICIONAR CENAS */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  {/* Botão de Arquivos do Computador */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onAddFiles(e.target.files);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Adicionar Fotos do Computador</span>
                  </button>

                  {/* Botão de Captura do SketchUp */}
                  {onCaptureSkpView && (
                    <button
                      type="button"
                      onClick={onCaptureSkpView}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-[#1c4432] border border-[#2c5842]/40 text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                      title="Captura a tela atual do SketchUp e adiciona diretamente a este lote"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      <span>📸 Capturar Cena Atual SketchUp</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-stone-600 font-semibold">
                  {scenes.length} cena(s) adicionada(s)
                </div>
              </div>

              {/* LISTAGEM DAS CENAS */}
              {scenes.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white border border-dashed border-stone-300 rounded-xl space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#1c4432]">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-800">Nenhuma cena no lote ainda</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    Clique no botão acima para adicionar múltiplos prints de ângulos diferentes do mesmo ambiente.
                    A IA irá cruzar todos eles para criar materiais e iluminação 100% harmônicos!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {scenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      className="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-xs hover:shadow-md transition flex flex-col group"
                    >
                      {/* THUMBNAIL DA CENA */}
                      <div className="relative aspect-4/3 bg-stone-100 overflow-hidden">
                        <img
                          src={scene.image}
                          alt={scene.name || `Cena ${scene.sceneCode}`}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                        {/* BADGE DO CÓDIGO DA CENA */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <select
                            value={scene.sceneCode}
                            onChange={(e) => handleChangeCode(scene.id, e.target.value)}
                            className="bg-[#113222] text-white text-[11px] font-extrabold px-2 py-0.5 rounded shadow-md border border-[#4ade80]/50 outline-none cursor-pointer"
                            title="Selecione o código único da cena (A1 a P15)"
                          >
                            {AVAILABLE_CODES.map((code) => (
                              <option key={code} value={code} className="bg-stone-900 text-white">
                                {code}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* AÇÕES NO TOPO DO PRINT: COPIAR IMAGEM E EXCLUIR */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                          {/* BOTÃO COPIAR IMAGEM DO PRINT */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySceneImage(scene);
                            }}
                            className={`px-2 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 shadow-md transition cursor-pointer backdrop-blur-xs border active:scale-95 ${
                              copiedSceneImageId === scene.id
                                ? 'bg-emerald-600 text-white border-emerald-400'
                                : 'bg-black/70 hover:bg-[#1c4432] text-white border-white/20 hover:border-emerald-400/50'
                            }`}
                            title="Copiar imagem deste print para a área de transferência"
                          >
                            {copiedSceneImageId === scene.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar Print</span>
                              </>
                            )}
                          </button>

                          {/* BOTÃO DE EXCLUIR CENA */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveScene(scene.id);
                            }}
                            className="w-6 h-6 rounded-md bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition cursor-pointer shadow-md border border-white/20"
                            title="Remover cena do lote"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* RESOLUÇÃO */}
                        {scene.width && scene.height && (
                          <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                            {scene.width}x{scene.height}
                          </div>
                        )}
                      </div>

                      {/* INFORMAÇÕES DA CENA */}
                      <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[11px] font-bold text-stone-800">
                          <span className="truncate">{scene.name || `Cena ${scene.sceneCode}`}</span>
                          {scene.generatedPrompt && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Prompt OK
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          value={scene.customNote || ''}
                          onChange={(e) => handleChangeSceneNote(scene.id, e.target.value)}
                          placeholder="Nota deste ângulo (ex: focar no sofá)..."
                          className="w-full text-[10.5px] px-2 py-1 border border-stone-200 rounded focus:border-[#1c4432] outline-none text-stone-700"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MATERIAIS UNIFICADOS DO AMBIENTE */}
          {activeTab === 'materials' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white border border-stone-200 p-3 rounded-lg flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Especificação Mestra Unificada de Materiais ({detectedMaterials.length})</span>
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Estes materiais serão travados rigorosamente em todas as cenas para garantir uniformidade total.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {detectedMaterials.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsAddingMaterial(!isAddingMaterial)}
                        className="px-3 py-1.5 bg-white hover:bg-stone-50 text-[#1c4432] border border-[#1c4432]/30 text-xs font-bold rounded flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        title="Adicionar um novo material ou objeto manualmente"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#1c4432]" />
                        <span>Adicionar Material</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAllMaterials}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded flex items-center gap-1.5 transition cursor-pointer"
                        title="Copiar lista completa de materiais unificados formatada"
                      >
                        {copiedId === 'all-materials' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copiar Todos</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={handleDetectBatchMaterials}
                    disabled={isDetecting || scenes.length === 0}
                    className="px-3.5 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                    <span>{isDetecting ? 'Analisando...' : 'Atualizar / Ler Materiais'}</span>
                  </button>
                </div>
              </div>

              {/* FORMULÁRIO DE ADIÇÃO MANUAL DE MATERIAL */}
              {isAddingMaterial && (
                <form onSubmit={handleAddNewMaterial} className="p-3.5 bg-white border-2 border-[#1c4432]/40 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                    <span className="text-xs font-bold text-[#1c4432] flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>Adicionar Novo Material ou Objeto ao Ambiente</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingMaterial(false)}
                      className="text-stone-400 hover:text-stone-600 cursor-pointer"
                      title="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        Elemento / Objeto:
                      </label>
                      <input
                        type="text"
                        value={newElement}
                        onChange={(e) => setNewElement(e.target.value)}
                        placeholder="Ex: Bancada da Cozinha em Mármore Paraná"
                        className="w-full px-2.5 py-1.5 text-xs font-bold border border-stone-300 rounded-lg text-stone-900 outline-none focus:border-[#1c4432]"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        Categoria:
                      </label>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Ex: Marcenaria, Estrutural, Mobiliário..."
                        className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg text-stone-900 outline-none focus:border-[#1c4432]"
                      />
                    </div>

                    <div className="sm:col-span-12">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        Especificação Técnica PBR & Acabamento:
                      </label>
                      <textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={2}
                        placeholder="Ex: Mármore branco com veios acinzentados suaves, acabamento levigado fosco, roughness 0.35, reflexos difusos elegantes..."
                        className="w-full p-2.5 text-xs border border-stone-300 rounded-lg text-stone-900 outline-none focus:border-[#1c4432] resize-y"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingMaterial(false)}
                      className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Material</span>
                    </button>
                  </div>
                </form>
              )}

              {/* FILTROS E BUSCA QUANDO HOUVER MATERIAIS */}
              {detectedMaterials.length > 0 && (
                <div className="flex items-center justify-between gap-2.5 flex-wrap bg-white border border-stone-200 p-2.5 rounded-lg">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1 min-w-[200px]">
                    {['Todos', 'Estrutural', 'Marcenaria', 'Metais & Esquadrias', 'Mobiliário', 'Têxteis', 'Iluminação & Eletros', 'Objetos & Decoração'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedMaterialCategory(cat)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap transition cursor-pointer shrink-0 ${
                          selectedMaterialCategory === cat
                            ? 'bg-[#1c4432] text-white shadow-2xs font-bold'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-52 shrink-0">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                      placeholder="Filtrar material..."
                      className="w-full pl-8 pr-6 py-1 text-xs bg-stone-50 border border-stone-200 focus:border-[#1c4432] rounded-md outline-none text-stone-800 placeholder:text-stone-400 transition"
                    />
                    {materialSearch && (
                      <button
                        type="button"
                        onClick={() => setMaterialSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* LISTA OU ESTADO VAZIO */}
              {detectedMaterials.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white border border-stone-200 rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h4 className="text-xs font-bold text-stone-700">Leitura de materiais pendente</h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Clique no botão verde acima para cruzar todas as cenas adicionadas e extrair a leitura unificada de piso, marcenaria e iluminação.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredMaterials.map((mat, idx) => {
                    const isEditing = editingMaterialId === mat.id;

                    if (isEditing) {
                      return (
                        <div
                          key={mat.id || idx}
                          className="p-3.5 bg-white border-2 border-[#1c4432] rounded-xl shadow-xs space-y-2.5 transition"
                        >
                          <div className="flex items-center justify-between border-b border-stone-200/80 pb-1.5">
                            <span className="text-xs font-bold text-[#1c4432] flex items-center gap-1.5">
                              <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Editar Material / Objeto</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleCancelEditMaterial}
                              className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <div className="sm:col-span-5">
                              <label className="block text-[10.5px] font-bold text-stone-700 mb-0.5">
                                Elemento / Objeto:
                              </label>
                              <input
                                type="text"
                                value={editElement}
                                onChange={(e) => setEditElement(e.target.value)}
                                placeholder="Nome do elemento..."
                                className="w-full px-2.5 py-1.5 text-xs font-bold border border-stone-300 rounded text-stone-900 outline-none focus:border-[#1c4432]"
                              />
                            </div>

                            <div className="sm:col-span-7">
                              <label className="block text-[10.5px] font-bold text-stone-700 mb-0.5">
                                Categoria:
                              </label>
                              <input
                                type="text"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                placeholder="Categoria..."
                                className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded text-stone-900 outline-none focus:border-[#1c4432]"
                              />
                            </div>

                            <div className="sm:col-span-12">
                              <label className="block text-[10.5px] font-bold text-stone-700 mb-0.5">
                                Especificação Técnica PBR:
                              </label>
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={3}
                                autoFocus
                                className="w-full p-2 text-xs border border-stone-300 rounded text-stone-900 leading-relaxed outline-none focus:border-[#1c4432] resize-y"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-stone-500">
                              Esta especificação será travada em todas as cenas do lote.
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditMaterial}
                                className="px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditMaterial(mat.id)}
                                className="px-3.5 py-1 bg-[#1c4432] hover:bg-[#163829] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Salvar Material</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={mat.id || idx}
                        className="p-3 bg-white border border-stone-200 hover:border-[#1c4432]/50 rounded-lg shadow-2xs group transition flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-[#e4ede8] text-[#1c4432] font-bold text-xs rounded border border-[#25543f]/20 shrink-0">
                              {mat.element}
                            </span>
                            {mat.category && (
                              <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 text-[10px] rounded font-semibold shrink-0">
                                {mat.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-700 leading-relaxed select-text">
                            {mat.description}
                          </p>
                        </div>

                        {/* Botões de Ação do Card: Editar, Salvar, Copiar, Excluir */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditMaterial(mat)}
                            className="px-2.5 py-1 text-xs font-bold bg-[#e4ede8] hover:bg-[#1c4432] text-[#1c4432] hover:text-white rounded transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 border border-[#1c4432]/20"
                            title="Editar especificação deste material"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickSaveMaterial(mat)}
                            className={`px-2.5 py-1 text-xs font-bold rounded transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 border ${
                              savedMaterialId === mat.id
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-[#1c4432] hover:bg-[#153426] text-white border-[#1c4432]'
                            }`}
                            title="Salvar e travar este material no lote do ambiente"
                          >
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>{savedMaterialId === mat.id ? 'Salvo!' : 'Salvar'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `[${mat.element}${mat.category ? ` - ${mat.category}` : ''}]: ${mat.description}`,
                                `mat-${mat.id || idx}`,
                                'Especificação copiada!'
                              )
                            }
                            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition cursor-pointer"
                            title="Copiar especificação deste item"
                          >
                            {copiedId === `mat-${mat.id || idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="Remover material do lote"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredMaterials.length === 0 && (
                    <div className="text-center py-6 text-xs text-stone-400 italic bg-stone-50 rounded-lg">
                      Nenhum material encontrado com o filtro "{materialSearch || selectedMaterialCategory}".
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUPER PROMPTS GERADOS */}
          {activeTab === 'prompts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white border border-stone-200 p-3 rounded-lg">
                <div>
                  <h4 className="text-xs font-bold text-stone-800">
                    Prompts Oficiais das Cenas ({scenes.filter((s) => Boolean(s.generatedPrompt)).length} / {scenes.length})
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Cada prompt possui o enquadramento exclusivo da sua câmera, mas compartilha a mesma base de materiais.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllPrompts}
                    disabled={!scenes.some((s) => Boolean(s.generatedPrompt))}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {copiedId === 'all-prompts' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateBatchPrompts}
                    disabled={isGeneratingPrompts || scenes.length === 0}
                    className="px-3.5 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-[#4ade80] ${isGeneratingPrompts ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingPrompts ? 'Gerando...' : 'Gerar Prompts do Lote'}</span>
                  </button>
                </div>
              </div>

              {/* LISTAGEM DOS PROMPTS POR CENA */}
              <div className="space-y-2">
                {scenes.map((scene) => (
                  <div key={scene.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-2xs">
                    <div 
                      className="flex items-center justify-between px-3 py-2.5 bg-stone-50 hover:bg-stone-100/80 cursor-pointer transition select-none"
                      onClick={() => setExpandedSceneId(expandedSceneId === scene.id ? null : scene.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="bg-[#113222] text-[#4ade80] font-mono font-bold text-xs px-2 py-0.5 rounded border border-[#4ade80]/40">
                          {scene.sceneCode}
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {scene.name || `Cena ${scene.sceneCode}`}
                        </span>
                        {scene.customNote && (
                          <span className="text-[10px] text-stone-500 italic max-w-xs truncate">
                            ({scene.customNote})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {scene.generatedPrompt && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(scene.generatedPrompt!, `scene-${scene.id}`, `Prompt da cena ${scene.sceneCode} copiado!`);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-stone-700 hover:text-[#1c4432] border border-stone-200 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          >
                            {copiedId === `scene-${scene.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copiar</span>
                          </button>
                        )}
                        {expandedSceneId === scene.id ? <ChevronUp className="w-4 h-4 text-stone-500" /> : <ChevronDown className="w-4 h-4 text-stone-500" />}
                      </div>
                    </div>

                    {expandedSceneId === scene.id && (
                      <div className="p-3 bg-stone-900 text-stone-100 text-xs font-mono leading-relaxed max-h-72 overflow-y-auto border-t border-stone-200">
                        {scene.generatedPrompt ? (
                          <pre className="whitespace-pre-wrap select-text font-sans">{scene.generatedPrompt}</pre>
                        ) : (
                          <div className="text-stone-400 italic font-sans py-2 text-center">
                            Prompt ainda não gerado para esta cena. Clique no botão "Gerar Prompts do Lote" acima.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER DO MODAL */}
        <div className="flex items-center justify-between px-4 py-3 bg-stone-100 border-t border-stone-200 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-700">Lote Ativo:</span>
            <span className="text-stone-600">{scenes.length} cena(s)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Enviar Lote para o Chat */}
            {onApplyBatchToChat && scenes.some((s) => Boolean(s.generatedPrompt)) && (
              <button
                type="button"
                onClick={handleSendToChat}
                className="px-3.5 py-1.5 bg-[#113222] hover:bg-[#1c4432] text-[#4ade80] border border-[#4ade80]/40 font-bold rounded flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
              >
                <span>💬 Aplicar Lote ao Chat</span>
              </button>
            )}

            {/* Ação Primária dependendo da etapa */}
            {activeTab === 'scenes' && (
              <button
                type="button"
                onClick={handleDetectBatchMaterials}
                disabled={isDetecting || scenes.length === 0}
                className="px-4 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white font-bold rounded flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#4ade80] ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Lendo Materiais...' : '🔍 Ler Materiais do Ambiente'}</span>
              </button>
            )}

            {activeTab === 'materials' && (
              <button
                type="button"
                onClick={handleGenerateBatchPrompts}
                disabled={isGeneratingPrompts || scenes.length === 0}
                className="px-4 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white font-bold rounded flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#4ade80] ${isGeneratingPrompts ? 'animate-spin' : ''}`} />
                <span>{isGeneratingPrompts ? 'Gerando Prompts...' : '✨ Gerar Super Prompts'}</span>
              </button>
            )}

            {activeTab === 'prompts' && (
              <button
                type="button"
                onClick={handleCopyAllPrompts}
                disabled={!scenes.some((s) => Boolean(s.generatedPrompt))}
                className="px-4 py-1.5 bg-[#1c4432] hover:bg-[#163829] text-white font-bold rounded flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Todos os Prompts</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
