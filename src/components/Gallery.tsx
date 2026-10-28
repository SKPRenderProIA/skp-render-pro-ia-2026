import React, { useState, useEffect } from 'react';
import { Copy, Trash2, ExternalLink, Image as ImageIcon, Download, Check } from 'lucide-react';
import { safeStorage } from '../lib/safeStorage';

interface GalleryItem {
  id: string;
  image: string;
  prompt: string;
  timestamp: number;
}

interface GalleryProps {
  onSelectPrompt: (prompt: string) => void;
  onCopyText: (text: string) => void;
  onCopyImage?: (dataUrl: string, idTag?: string) => Promise<void> | void;
  onShowToast: (msg: string) => void;
  bottomOffset?: number;
  isOpen?: boolean;
  onClose?: () => void;
  onClear?: () => void;
}

export function Gallery({ 
  onSelectPrompt, 
  onCopyText, 
  onCopyImage, 
  onShowToast, 
  bottomOffset = 96,
  isOpen: propsIsOpen,
  onClose,
  onClear
}: GalleryProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = propsIsOpen !== undefined ? propsIsOpen : internalIsOpen;

  const handleClose = () => {
    if (onClose) onClose();
    setInternalIsOpen(false);
  };
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);

  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    try {
      const saved = safeStorage.getItem('skp_gallery');
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Error loading gallery from storage:', e);
    }
  }, []);

  const saveItems = (newItems: GalleryItem[]) => {
    setItems(newItems);
    try {
      safeStorage.setItem('skp_gallery', JSON.stringify(newItems));
    } catch (e) {
      console.warn('Storage save failed:', e);
      try {
        safeStorage.setItem('skp_gallery', JSON.stringify(newItems.slice(0, 5)));
      } catch (_) {}
    }
  };

  const deleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newItems = items.filter(item => item.id !== id);
    saveItems(newItems);
  };

  const clearGallery = () => {
    saveItems([]);
    setConfirmClear(false);
    if (onClear) {
      onClear();
    }
    try {
      safeStorage.removeItem('skp_chat_messages');
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('clear-skp-gallery-and-chat'));
    onShowToast('✓ Galeria e histórico do chat limpos!');
  };

  // Download image file
  const handleDownloadImage = (dataUrl: string, filename?: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || `SKP_Print_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onShowToast('✓ Download do print iniciado!');
    } catch (err) {
      console.error('Download error:', err);
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${dataUrl}" style="max-width:95%;max-height:95%;object-fit:contain;"/></body>`);
      }
    }
  };

  // Copy Image to Clipboard with multiple fallbacks
  const handleCopyImage = async (dataUrl: string, id: string) => {
    try {
      if (onCopyImage) {
        await onCopyImage(dataUrl, `gal-img-${id}`);
        setCopiedImageId(id);
        setTimeout(() => setCopiedImageId(null), 2500);
        return;
      }

      // Try SketchUp ruby bridge
      try {
        if ((window as any).sketchup?.copiar_imagem) {
          (window as any).sketchup.copiar_imagem(dataUrl);
        }
      } catch (_) {}

      // Convert to PNG blob via canvas for standard ClipboardItem acceptance
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );

      if (!blob) throw new Error('Failed to create PNG blob');

      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedImageId(id);
        setTimeout(() => setCopiedImageId(null), 2500);
        onShowToast('✓ Print copiado! Pressione Ctrl+V no Gemini para colar.');
        return;
      }
      throw new Error('Clipboard API not available');
    } catch (err) {
      console.warn('Copy image to clipboard failed, downloading fallback:', err);
      handleDownloadImage(dataUrl, `SKP_Print_${id}.png`);
      onShowToast('✓ Área de transferência indisponível: Print baixado!');
    }
  };

  const handleCopyPrompt = (prompt: string, id: string) => {
    onCopyText(prompt);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  // Listen for custom event to add items to gallery
  useEffect(() => {
    const handleAdd = (e: any) => {
      const { image, prompt } = e?.detail || {};
      if (!image && !prompt) return;

      const newItem: GalleryItem = {
        id: Date.now().toString(),
        image: image || '',
        prompt: prompt || '',
        timestamp: Date.now(),
      };

      setItems((prev) => {
        const updated = [newItem, ...prev].slice(0, 30); // Keep last 30 items
        try {
          safeStorage.setItem('skp_gallery', JSON.stringify(updated));
        } catch (storageErr) {
          console.warn('Storage quota full, saving fewer gallery items:', storageErr);
          try {
            // If quota is tight, retain fewer items without large payloads
            const trimmed = updated.slice(0, 5);
            safeStorage.setItem('skp_gallery', JSON.stringify(trimmed));
          } catch (_) {
            // Never throw
          }
        }
        return updated;
      });
    };

    window.addEventListener('add-to-skp-gallery', handleAdd);
    return () => window.removeEventListener('add-to-skp-gallery', handleAdd);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#f4f7f6] w-full max-w-lg h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-stone-200">
        <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#396252]" />
            <h2 className="font-bold text-[#396252] tracking-wide uppercase text-sm">GALERIA DE HISTÓRICO</h2>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button 
                onClick={clearGallery}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-tighter cursor-pointer"
              >
                Limpar Tudo
              </button>
            )}
            <button 
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition cursor-pointer font-bold text-base"
              title="Fechar galeria"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-3">
              <ImageIcon className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium">Sua galeria está vazia.</p>
              <p className="text-[11px] text-center max-w-[200px]">As imagens e prompts analisados aparecerão aqui para consultas e downloads futuros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-lg overflow-hidden border border-stone-200 shadow-sm group relative flex flex-col justify-between"
                >
                  <div className="aspect-[4/5] relative bg-stone-100">
                    <img 
                      src={item.image} 
                      alt="Histórico" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          const newWindow = window.open();
                          newWindow?.document.write(`<body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${item.image}" style="max-width:95%;max-height:95%;object-fit:contain;"/></body>`);
                        }}
                        className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition cursor-pointer"
                        title="Ver em tela cheia"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadImage(item.image, `SKP_Print_${item.id}.png`)}
                        className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition cursor-pointer"
                        title="Baixar print"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400 font-medium">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={(e) => deleteItem(item.id, e)}
                        className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                        title="Excluir do histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyPrompt(item.prompt, item.id)}
                        className="w-full py-1.5 bg-[#396252] text-white text-[9px] font-bold rounded uppercase flex items-center justify-center gap-1.5 transition hover:bg-[#2b4c3e] cursor-pointer"
                        title="Copiar prompt desta cena"
                      >
                        {copiedPromptId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#4ade80]" />
                            <span>Prompt Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar Prompt</span>
                          </>
                        )}
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyImage(item.image, item.id)}
                          className="py-1.5 bg-stone-100 text-stone-700 hover:bg-[#eef3f0] hover:text-[#396252] text-[9px] font-bold rounded uppercase flex items-center justify-center gap-1 transition border border-stone-200 cursor-pointer"
                          title="Copiar print para o Clipboard (Ctrl+V)"
                        >
                          {copiedImageId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadImage(item.image, `SKP_Print_${item.id}.png`)}
                          className="py-1.5 bg-[#9AAEA3]/25 text-[#396252] hover:bg-[#9AAEA3]/50 text-[9px] font-bold rounded uppercase flex items-center justify-center gap-1 transition border border-[#9AAEA3]/40 cursor-pointer"
                          title="Baixar arquivo PNG do print"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
