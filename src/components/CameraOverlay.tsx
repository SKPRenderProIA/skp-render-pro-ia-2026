import React from 'react';
import { RenderConfig } from '../types';

interface CameraOverlayProps {
  config: RenderConfig;
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  config,
  isOpen,
  onClose,
  onExport,
}) => {
  if (!isOpen) return null;

  const aspectRatio = config.width / config.height;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl overflow-hidden max-w-2xl w-full flex flex-col border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#396252] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-['Oswald'] tracking-wider text-sm uppercase">VISUALIZADOR DE CÂMERA & ENQUADRAMENTO</span>
            <span className="bg-[#4ade80] text-[#396252] text-[10px] font-bold px-1.5 py-0.5 rounded">SKP PRO</span>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white text-lg font-bold px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>

        {/* Viewport Canvas Simulation - Frame Buffer na cor verde claro com 60% de transparência */}
        <div className="p-4 bg-[#4ade80]/40 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden border-y border-[#4ade80]/30">
          {/* Simulated 3D Scene viewport */}
          <div 
            className="relative border-2 border-[#4ade80] shadow-lg transition-all duration-300 flex items-center justify-center bg-stone-800"
            style={{
              aspectRatio: `${aspectRatio}`,
              maxHeight: '280px',
              maxWidth: '90%',
              width: `${Math.min(320 * aspectRatio, 420)}px`,
            }}
          >
            {/* Background 3D grid architectural placeholder */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            {/* Center Reticle */}
            <div className="absolute w-4 h-4 border border-white/60 rounded-full flex items-center justify-center pointer-events-none">
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>

            {/* Viewport Info pill */}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-mono flex items-center gap-2">
              <span>{config.width} × {config.height} px</span>
              <span className="text-[#4ade80]">
                {config.ratio === 0.8 ? "4:5 Insta" : config.ratio === 0.5625 ? "9:16 Stories" : config.ratio === 1 ? "1:1 Square" : "16:9 Wide"}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Info & Actions */}
        <div className="p-4 bg-white flex flex-wrap items-center justify-end gap-3 border-t border-stone-200">
          <div className="text-xs text-stone-600 mr-auto">
            <span className="font-bold text-[#396252]">Status do Frame:</span> Visualizador Ativo
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#396252] text-white text-xs font-bold rounded uppercase tracking-wider hover:opacity-90 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
