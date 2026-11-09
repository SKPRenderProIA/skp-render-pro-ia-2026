import React, { useState, useEffect } from 'react';
import { Download, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageViewerPopoutViewProps {
  showToast?: (msg: string) => void;
}

export const ImageViewerPopoutView: React.FC<ImageViewerPopoutViewProps> = ({ showToast }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('skp_viewer_image_url');
      if (stored) {
        setImageUrl(stored);
      }
    } catch (_) {}

    (window as any).carregarImagemExternaViewer = (dataUrl: string) => {
      if (dataUrl) {
        setImageUrl(dataUrl);
        try {
          localStorage.setItem('skp_viewer_image_url', dataUrl);
        } catch (_) {}
      }
    };

    try {
      if ((window as any).sketchup?.solicitar_imagem_viewer_inicial) {
        (window as any).sketchup.solicitar_imagem_viewer_inicial();
      }
    } catch (_) {}

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'LOAD_VIEWER_IMAGE' && e.data.imageUrl) {
        setImageUrl(e.data.imageUrl);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDownload = () => {
    if (!imageUrl) return;
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `SKP_Render_Pro_Alta_Resolucao_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast?.('✓ Download da imagem em alta resolução iniciado!');
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b1410] text-white font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 bg-[#14281e] border-b border-[#244834] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs sm:text-sm text-[#4ade80] tracking-wide">
            SKP RENDER PRO IA — VISUALIZADOR EM TELA CHEIA (ALTA RESOLUÇÃO)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!imageUrl}
            className="px-3 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer border border-[#4ade80]/40 disabled:opacity-50"
            title="Baixar imagem em alta resolução"
          >
            <Download className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>Baixar Imagem</span>
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                if ((window as any).sketchup?.fechar_dialogo_materiais) {
                  (window as any).sketchup.fechar_dialogo_materiais();
                }
              } catch (_) {}
              try { window.close(); } catch (_) {}
            }}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer border border-white/20"
            title="Fechar Janela"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4 bg-[#070d0a] relative overflow-auto">
        {imageUrl ? (
          <div 
            className="transition-transform duration-150 origin-center flex items-center justify-center max-w-full max-h-full"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src={imageUrl}
              alt="Render em alta resolução"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/20"
            />
          </div>
        ) : (
          <div className="text-center p-8 text-stone-400 flex flex-col items-center gap-2">
            <p className="text-sm font-medium">Nenhuma imagem carregada no visualizador.</p>
            <p className="text-xs text-stone-500">Abra a imagem a partir do chat do plugin.</p>
          </div>
        )}
      </main>

      {/* Footer controls for zoom */}
      <footer className="px-4 py-2 bg-[#14281e] border-t border-[#244834] flex items-center justify-between text-xs shrink-0">
        <span className="text-stone-400 text-[11px]">Dica: Use os botões abaixo para ajustar o zoom e examinar todos os detalhes.</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition cursor-pointer"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-stone-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded transition cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-mono transition cursor-pointer"
            title="Resetar Zoom"
          >
            1:1
          </button>
        </div>
      </footer>
    </div>
  );
};
