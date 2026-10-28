import React from 'react';

export const SkpLogo: React.FC<{ className?: string }> = ({ className = "logo-img" }) => (
  <svg 
    className={className} 
    viewBox="0 0 200 60" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ maxHeight: '60px', width: 'auto' }}
  >
    {/* 3D Isometric Cube / Camera Viewport */}
    <g transform="translate(10, 8)">
      {/* Top Face */}
      <path d="M22 2 L42 12 L22 22 L2 12 Z" fill="#4ade80" fillOpacity="0.9" />
      {/* Left Face */}
      <path d="M2 12 L22 22 L22 42 L2 32 Z" fill="#396252" />
      {/* Right Face */}
      <path d="M22 22 L42 12 L42 32 L22 42 Z" fill="#9AAEA3" />
      {/* Viewport Reticle / Lens Crosshair */}
      <circle cx="22" cy="22" r="7" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 1" />
      <circle cx="22" cy="22" r="2.5" fill="#4ade80" />
    </g>
    {/* Text Badge */}
    <text x="60" y="27" fill="#396252" fontFamily="'Oswald', sans-serif" fontSize="18" fontWeight="700" letterSpacing="1.5">
      SKP RENDER
    </text>
    <text x="60" y="44" fill="#9AAEA3" fontFamily="'Oswald', sans-serif" fontSize="13" fontWeight="600" letterSpacing="2.5">
      PRO <tspan fill="#4ade80">● IA</tspan>
    </text>
  </svg>
);

export const GemIcon: React.FC<{ className?: string; style?: React.CSSProperties; size?: number; onClick?: () => void }> = ({ 
  className = "btn-social", 
  style,
  size = 26,
  onClick 
}) => (
  <button 
    type="button" 
    onClick={onClick} 
    className={className} 
    title="Abrir Gemini Gem IA"
    style={{ border: 'none', background: 'transparent', padding: 0, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
  >
    <svg 
      viewBox="0 0 64 64" 
      width={size} 
      height={size} 
      className="rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <defs>
        <linearGradient id="gemBgBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#142820" />
          <stop offset="100%" stopColor="#244537" />
        </linearGradient>
        <linearGradient id="gemGradBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#gemBgBtn)" stroke="#60a5fa" strokeWidth="2.5" />
      <path d="M 32 10 Q 32 28 50 32 Q 32 36 32 54 Q 32 36 14 32 Q 32 28 32 10 Z" fill="url(#gemGradBtn)" />
      <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
      <path d="M 46 16 Q 46 22 52 23 Q 46 24 46 30 Q 46 24 40 23 Q 46 22 46 16 Z" fill="#ffffff" opacity="0.85" />
    </svg>
  </button>
);

export const OrangeGemIcon: React.FC<{ className?: string; style?: React.CSSProperties; size?: number; onClick?: () => void; title?: string }> = ({ 
  className = "btn-social", 
  style,
  size = 26,
  onClick,
  title = "SKP IA 01"
}) => (
  <button 
    type="button" 
    name="skp-ia-01"
    id="btnSkpIa01"
    onClick={onClick} 
    className={className} 
    title={title}
    aria-label="SKP IA 01"
    style={{ border: 'none', background: 'transparent', padding: 0, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
  >
    <svg 
      viewBox="0 0 64 64" 
      width={size} 
      height={size} 
      className="rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <defs>
        <linearGradient id="orangeGemBgBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#431407" />
          <stop offset="50%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id="orangeGemGradBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffedd5" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#orangeGemBgBtn)" stroke="#f97316" strokeWidth="2.5" />
      <path d="M 32 10 Q 32 28 50 32 Q 32 36 32 54 Q 32 36 14 32 Q 32 28 32 10 Z" fill="url(#orangeGemGradBtn)" />
      <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
      <path d="M 46 16 Q 46 22 52 23 Q 46 24 46 30 Q 46 24 40 23 Q 46 22 46 16 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  </button>
);

export const PurpleGemIcon: React.FC<{ className?: string; style?: React.CSSProperties; size?: number; onClick?: () => void; title?: string }> = ({ 
  className = "btn-social", 
  style,
  size = 26,
  onClick,
  title = "SKP IA 02"
}) => (
  <button 
    type="button" 
    name="skp-ia-02"
    id="btnSkpIa02"
    onClick={onClick} 
    className={className} 
    title={title}
    aria-label="SKP IA 02"
    style={{ border: 'none', background: 'transparent', padding: 0, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
  >
    <svg 
      viewBox="0 0 64 64" 
      width={size} 
      height={size} 
      className="rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <defs>
        <linearGradient id="purpleGemBgBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2e1065" />
          <stop offset="50%" stopColor="#581c87" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="purpleGemGradBtn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#faf5ff" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#purpleGemBgBtn)" stroke="#a855f7" strokeWidth="2.5" />
      <path d="M 32 10 Q 32 28 50 32 Q 32 36 32 54 Q 32 36 14 32 Q 32 28 32 10 Z" fill="url(#purpleGemGradBtn)" />
      <circle cx="32" cy="32" r="3.5" fill="#ffffff" />
      <path d="M 46 16 Q 46 22 52 23 Q 46 24 46 30 Q 46 24 40 23 Q 46 22 46 16 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  </button>
);

export const InstagramIcon: React.FC<{ className?: string; style?: React.CSSProperties; size?: number; onClick?: () => void }> = ({ 
  className = "btn-social", 
  style,
  size = 26,
  onClick 
}) => (
  <button 
    type="button" 
    onClick={onClick} 
    className={className} 
    title="Instagram SKP Render Pro"
    style={{ border: 'none', background: 'transparent', padding: 0, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
  >
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ width: `${size}px`, height: `${size}px` }} fill="none" stroke="#396252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  </button>
);

export const WhatsAppIcon: React.FC<{ className?: string; style?: React.CSSProperties; size?: number; onClick?: () => void }> = ({ 
  className = "btn-social", 
  style,
  size = 26,
  onClick 
}) => (
  <button 
    type="button" 
    onClick={onClick} 
    className={className} 
    title="WhatsApp Suporte / Comunidade"
    style={{ border: 'none', background: 'transparent', padding: 0, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
  >
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ width: `${size}px`, height: `${size}px` }} fill="#396252">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  </button>
);

export const BrFlag: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="#009c3b" d="M0 0h640v480H0z"/>
    <path fill="#ffdf00" d="M320 40L40 240l280 200 280-200Z"/>
    <circle cx="320" cy="240" r="90" fill="#002776" />
    <path fill="#fff" d="M230 240c0-50 40-90 90-90 50 0 90 40 90 90-10-10-30-20-90-20s-80 10-90 20z" />
  </svg>
);

export const UsFlag: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 640 480" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fill="#bd3d44" d="M0 0h640v480H0z"/>
    <path stroke="#fff" strokeWidth="37" d="M0 55.4h640M0 129.2h640M0 203h640M0 277h640M0 350.8h640M0 424.6h640"/>
    <path fill="#192f5d" d="M0 0h256v240H0z"/>
    <g fill="#fff">
      {/* Small stars representation for micro-UI compatibility */}
      <circle cx="25" cy="42" r="6" />
      <circle cx="67" cy="42" r="6" />
      <circle cx="109" cy="42" r="6" />
      <circle cx="151" cy="42" r="6" />
      <circle cx="193" cy="42" r="6" />
      <circle cx="46" cy="61" r="6" />
      <circle cx="88" cy="61" r="6" />
      <circle cx="130" cy="61" r="6" />
      <circle cx="172" cy="61" r="6" />
      <circle cx="25" cy="80" r="6" />
      <circle cx="67" cy="80" r="6" />
      <circle cx="109" cy="80" r="6" />
      <circle cx="151" cy="80" r="6" />
      <circle cx="193" cy="80" r="6" />
    </g>
  </svg>
);

export const EsFlag: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg width={size} height={size * 0.67} viewBox="0 0 750 500" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="750" height="500" fill="#aa151b"/>
    <rect width="750" height="250" y="125" fill="#f1bf00"/>
    {/* Simplified Coat of Arms */}
    <g transform="translate(180, 190) scale(0.8)">
      <path fill="#aa151b" d="M0 0h80v100c0 20-20 40-40 40s-40-20-40-40V0z" stroke="#000" strokeWidth="3" />
      <path fill="#f1bf00" d="M20 30h40v40H20z" stroke="#000" strokeWidth="2" />
    </g>
  </svg>
);
