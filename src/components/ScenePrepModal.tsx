import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, Camera, 
  CheckCircle2, Sliders, ChevronUp, ChevronDown, 
  Target, Aperture, CircleDot, Focus, Info, Maximize2, Palette,
  Layers, Wand2, Trash2, Shield, Eye, Lightbulb, Zap, Sun, PaintBucket
} from 'lucide-react';
import { SurfaceReflectType } from '../types';

export type FakeLightType = 'fita_led' | 'spot' | 'plafon';
export type FakeLightObjectType = 'marcenaria' | 'espelho';
export type FakeLightDirection = 'baixo' | 'cima' | 'fora' | 'dentro' | 'duplo' | 'esquerda' | 'direita';

export interface FakeLightColorPreset {
  id: string;
  label: string;
  kelvin: string;
  hex: string;
  desc: string;
  recommended?: boolean;
}

export const FAKE_LIGHT_COLOR_PRESETS: FakeLightColorPreset[] = [
  { id: '2700k', label: '2700K', kelvin: 'Âmbar Suave', hex: '#ffd18c', desc: 'Aconchegante e intimista' },
  { id: '3000k', label: '3000K', kelvin: 'Branco Quente', hex: '#ffe7ae', desc: 'Clássico para teto e sancas (Oficial do Vídeo)', recommended: true },
  { id: '4000k', label: '4000K', kelvin: 'Branco Neutro', hex: '#fff5e0', desc: 'Luz neutra equilibrada' },
  { id: '6000k', label: '6000K', kelvin: 'Branco Frio', hex: '#f0f8ff', desc: 'Moderno e tecnológico' },
  { id: 'dourado', label: 'Dourado', kelvin: 'Ouro Realce', hex: '#f59e0b', desc: 'Destaque e vibração' },
  { id: 'neon', label: 'Cenográfico', kelvin: 'Azul Suave', hex: '#93c5fd', desc: 'Ambientação relaxante' },
];

export const SURFACE_PRESETS: {
  id: SurfaceReflectType;
  label: string;
  icon: string;
  desc: string;
  defaultDarkening: number;
  defaultOpacity: number;
}[] = [
  {
    id: 'espelho',
    label: 'Espelho',
    icon: '🪞',
    desc: 'Reflexo cristalino 100% nítido com fidelidade óptica real',
    defaultDarkening: 0,
    defaultOpacity: 100,
  },
  {
    id: 'piso',
    label: 'Piso',
    icon: '🏢',
    desc: 'Porcelanato e pisos polidos com reflexo acetinado suave',
    defaultDarkening: 10,
    defaultOpacity: 22,
  },
  {
    id: 'tv',
    label: 'TV',
    icon: '📺',
    desc: 'Tela preta de televisão ou monitor com reflexo sutil escurecido',
    defaultDarkening: 85,
    defaultOpacity: 45,
  },
  {
    id: 'vidro',
    label: 'Vidro',
    icon: '🪟',
    desc: 'Vidro incolor, esquadrias e box com alta transparência',
    defaultDarkening: 5,
    defaultOpacity: 35,
  },
  {
    id: 'bronze',
    label: 'Bronze',
    icon: '🥉',
    desc: 'Espelho reflecta bronze com tonalidade âmbar sofisticada',
    defaultDarkening: 35,
    defaultOpacity: 85,
  },
  {
    id: 'fume',
    label: 'Fumê',
    icon: '🕶️',
    desc: 'Vidro ou espelho escurecido tom chumbo contemporâneo',
    defaultDarkening: 65,
    defaultOpacity: 85,
  },
];

export interface OutputFormatOption {
  id: string;
  label: string;
  sublabel: string;
  ratio: number;
  defaultWidth: number;
  defaultHeight: number;
  description: string;
  usage: string;
}

export interface FocalLengthOption {
  id: string;
  label: string;
  sublabel: string;
  focalLength: number; // in mm
  fov: number; // in degrees approx (35mm sensor)
  type: string;
  description: string;
  usage: string;
}

export const OUTPUT_FORMATS: OutputFormatOption[] = [
  {
    id: '16_9',
    label: 'Paisagem',
    sublabel: '16:9',
    ratio: 16 / 9,
    defaultWidth: 2560,
    defaultHeight: 1440,
    description: 'Proporção Widescreen padrão (1.7778)',
    usage: 'Telas de TV, monitores, apresentações de arquitetura, slides e vídeos'
  },
  {
    id: '1_1',
    label: 'Quadrado',
    sublabel: '1:1',
    ratio: 1.0,
    defaultWidth: 2000,
    defaultHeight: 2000,
    description: 'Proporção Quadrada perfeita (1.0000)',
    usage: 'Posts tradicionais no feed do Instagram, LinkedIn e catálogos de blocos'
  },
  {
    id: '4_5',
    label: 'Feed',
    sublabel: '4:5',
    ratio: 4 / 5,
    defaultWidth: 2000,
    defaultHeight: 2500,
    description: 'Proporção Vertical Otimizada (0.8000)',
    usage: 'Feed do Instagram com ocupação máxima na tela de celulares sem cortes'
  },
  {
    id: '9_16',
    label: 'Retrato',
    sublabel: '9:16',
    ratio: 9 / 16,
    defaultWidth: 1440,
    defaultHeight: 2560,
    description: 'Proporção Vertical Completa (0.5625)',
    usage: 'Stories do Instagram, Reels, TikTok, YouTube Shorts e status em tela cheia'
  },
  {
    id: '5_4',
    label: '5:4',
    sublabel: '5:4',
    ratio: 5 / 4,
    defaultWidth: 2500,
    defaultHeight: 2000,
    description: 'Proporção Médio Formato (1.2500)',
    usage: 'Impressão fotográfica profissional de interiores e composições equilibradas'
  },
  {
    id: '4_3',
    label: 'Clássico',
    sublabel: '4:3',
    ratio: 4 / 3,
    defaultWidth: 2400,
    defaultHeight: 1800,
    description: 'Proporção Clássica de Câmeras e Telas (1.3333)',
    usage: 'Pranchas executivas A3/A4, iPads e telas de projeção para clientes'
  },
  {
    id: '3_2',
    label: 'Foto',
    sublabel: '3:2',
    ratio: 3 / 2,
    defaultWidth: 2400,
    defaultHeight: 1600,
    description: 'Proporção DSLR / Mirrorless 35mm (1.5000)',
    usage: 'Fotografia editorial de arquitetura e portfólios impressos'
  },
  {
    id: '7_5',
    label: '7:5',
    sublabel: '7:5',
    ratio: 7 / 5,
    defaultWidth: 2100,
    defaultHeight: 1500,
    description: 'Proporção Panorâmica Intermediária (1.4000)',
    usage: 'Molduras de quadros decorativos e apresentações corporativas'
  },
  {
    id: '360',
    label: '360° VR',
    sublabel: '2:1',
    ratio: 2.0,
    defaultWidth: 8000,
    defaultHeight: 4000,
    description: 'Panorama Equirretangular 360° (2.0000) Ultra HD 8K',
    usage: 'Tours virtuais interativos, visualizadores 360°, óculos VR e renders em altíssima resolução 8000x4000'
  }
];

export const FOCAL_LENGTHS: FocalLengthOption[] = [
  {
    id: '24mm',
    label: '24mm',
    sublabel: 'Grande ang.',
    focalLength: 24,
    fov: 84.1,
    type: 'Grande Angular Dinâmica',
    description: 'Visão expansiva com grande profundidade de campo.',
    usage: 'Excelente para interiores compactos, banheiros, lavabos e fachadas externas.'
  },
  {
    id: '35mm',
    label: '35mm',
    sublabel: 'Retrato leve',
    focalLength: 35,
    fov: 63.4,
    type: 'Grande Angular Suave / Olho Humano Expandido',
    description: 'Padrão ouro para interiores! Sem deformações exageradas nas bordas.',
    usage: 'Salas de estar, quartos, cozinhas integradas e perspectivas equilibradas.'
  },
  {
    id: '55mm',
    label: '55mm',
    sublabel: 'Normal',
    focalLength: 55,
    fov: 43.0,
    type: 'Lente Normal (Campo Natural)',
    description: 'Reproduz exatamente o foco e a proporção do olhar humano real.',
    usage: 'Paredes principais, vistas frontais de sofás, móveis e corredores lineares.'
  },
  {
    id: '70mm',
    label: '70mm',
    sublabel: 'Tele leve',
    focalLength: 70,
    fov: 34.4,
    type: 'Teleobjetiva Moderada',
    description: 'Comprime levemente o fundo destacando o primeiro plano arquitetônico.',
    usage: 'Ilhas gourmet, mesas de jantar postas, detalhes de marcenaria e iluminação.'
  },
  {
    id: '85mm',
    label: '85mm',
    sublabel: 'Retrato',
    focalLength: 85,
    fov: 28.6,
    type: 'Teleobjetiva de Detalhes / Closes',
    description: 'Compressão elegante de planos com isolamento cinematográfico.',
    usage: 'Closes de objetos decorativos, texturas de materiais, nichos e cantos de leitura.'
  },
  {
    id: 'custom',
    label: 'Custom',
    sublabel: '—',
    focalLength: 50,
    fov: 46.8,
    type: 'Ajuste Manual Personalizado',
    description: 'Escolha qualquer distância focal livre milímetro a milímetro.',
    usage: 'Ajustes finos para enquadramentos milimétricos específicos da sua cena.'
  }
];

// Helper to calculate horizontal FOV from focal length (36mm film width)
function calculateFovFromFocalLength(mm: number): number {
  if (mm <= 0) return 60;
  const rad = 2.0 * Math.atan(18.0 / mm);
  return Number((rad * (180.0 / Math.PI)).toFixed(1));
}

interface ScenePrepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (msg: string) => void;
  ratio?: number;
  width?: number;
  height?: number;
  safeFrame?: boolean;
  onUpdateFormat?: (newRatio: number, newWidth: number, newHeight: number) => void;
  onToggleSafeFrame?: (enabled: boolean) => void;
}

export const ScenePrepModal: React.FC<ScenePrepModalProps> = ({
  isOpen,
  onClose,
  onToast,
  ratio = 0.8,
  width = 2000,
  height = 2500,
  safeFrame = true,
  onUpdateFormat,
  onToggleSafeFrame,
}) => {
  // Collapsible sections state
  const [isFormatOpen, setIsFormatOpen] = useState<boolean>(true);
  const [isFocalOpen, setIsFocalOpen] = useState<boolean>(true);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(true);
  const [isMirrorGenerating, setIsMirrorGenerating] = useState<boolean>(false);
  const [isClearingReflects, setIsClearingReflects] = useState<boolean>(false);

  // Surface Reflection state (Espelho, Piso, TV, Vidro, Bronze, Fumê)
  const [selectedReflectType, setSelectedReflectType] = useState<SurfaceReflectType>('espelho');
  const [reflectDarkening, setReflectDarkening] = useState<number>(0);
  const [reflectOpacity, setReflectOpacity] = useState<number>(100);

  const handleSelectReflectPreset = (type: SurfaceReflectType) => {
    setSelectedReflectType(type);
    const preset = SURFACE_PRESETS.find(p => p.id === type);
    if (preset) {
      setReflectDarkening(preset.defaultDarkening);
      setReflectOpacity(preset.defaultOpacity);
      onToast?.(`✨ Preset "${preset.label}" selecionado para o próximo reflexo.`);
    }
  };

  // Ativar ferramenta de reflexo no SketchUp com reconhecimento verde esmeralda
  const handleActivateReflectTool = () => {
    const preset = SURFACE_PRESETS.find(p => p.id === selectedReflectType);
    const config = {
      type: selectedReflectType,
      darkening: reflectDarkening,
      opacity: reflectOpacity,
    };

    let triggered = false;
    try {
      if ((window as any).sketchup?.ativar_ferramenta_reflexo) {
        (window as any).sketchup.ativar_ferramenta_reflexo(JSON.stringify(config));
        triggered = true;
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('ativar_ferramenta_reflexo', JSON.stringify(config));
        triggered = true;
      }
    } catch (_) {}

    const label = preset?.label || 'Reflexo';
    if (triggered) {
      onToast?.(`🪞 Ferramenta ativa (${label})! Passe o mouse na face no SketchUp e dê 1 clique.`);
    } else {
      onToast?.(`💡 Ferramenta pronta (${label}): clique na face no SketchUp para aplicar o reflexo.`);
    }
  };

  // Apagar todos os planos de reflexo da cena com varredura completa
  const handleClearAllReflects = () => {
    setIsClearingReflects(true);
    let triggered = false;
    try {
      if ((window as any).sketchup?.apagar_todos_reflexos) {
        (window as any).sketchup.apagar_todos_reflexos('');
        triggered = true;
      }
      if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('apagar_todos_reflexos', JSON.stringify({}));
        triggered = true;
      }
    } catch (_) {}

    setTimeout(() => setIsClearingReflects(false), 800);

    if (triggered) {
      onToast?.('🗑️ Planos de reflexo removidos da cena com sucesso!');
    } else {
      onToast?.('🗑️ Nenhum plano de reflexo pendente para apagar.');
    }
  };

  // Restaurar cores reais dos reflexos existentes no modelo do SketchUp
  const [isFixingColors, setIsFixingColors] = useState<boolean>(false);
  const handleFixReflectColors = () => {
    setIsFixingColors(true);
    let triggered = false;
    try {
      if ((window as any).sketchup?.corrigir_cores_reflexos) {
        (window as any).sketchup.corrigir_cores_reflexos();
        triggered = true;
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('corrigir_cores_reflexos', JSON.stringify({}));
        triggered = true;
      }
    } catch (_) {}

    setTimeout(() => setIsFixingColors(false), 800);

    if (triggered) {
      onToast?.('🎨 Cores reais dos espelhos e reflexos restauradas com sucesso!');
    } else {
      onToast?.('🎨 Restauração acionada no SketchUp.');
    }
  };

  // Trigger Mirror Generation in SketchUp
  const handleTriggerMirror = () => {
    setIsMirrorGenerating(true);
    let triggered = false;
    try {
      if ((window as any).sketchup?.gerar_espelho_real) {
        (window as any).sketchup.gerar_espelho_real();
        triggered = true;
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('gerar_espelho_real', JSON.stringify({}));
        triggered = true;
      }
    } catch (_) {}

    setTimeout(() => setIsMirrorGenerating(false), 1000);

    if (triggered) {
      onToast?.('🪞 Calculando projeção de reflexão física no espelho do SketchUp...');
    } else {
      onToast?.('🪞 Selecione a face ou grupo do espelho no SketchUp antes de gerar.');
    }
  };

  // =========================================================================
  // 4. LUZ FAKE STATE & HANDLERS
  // =========================================================================
  const [isFakeLightOpen, setIsFakeLightOpen] = useState<boolean>(true);
  const [fakeLightType, setFakeLightType] = useState<FakeLightType>('fita_led');
  const [fakeLightObjectType, setFakeLightObjectType] = useState<FakeLightObjectType>('marcenaria');
  const [fakeLightDirection, setFakeLightDirection] = useState<FakeLightDirection>('baixo');
  const [fakeLightColor, setFakeLightColor] = useState<string>('#ffe7ae'); // Cor oficial do vídeo!
  const [fakeLightReach, setFakeLightReach] = useState<number>(25); // cm
  const [fakeLightIntensity, setFakeLightIntensity] = useState<number>(85); // %
  const [fakeLightAngle, setFakeLightAngle] = useState<number>(45); // graus para spot
  const [isClearingLights, setIsClearingLights] = useState<boolean>(false);
  const [isPaintingEmissive, setIsPaintingEmissive] = useState<boolean>(false);

  // Troca de tipo de luz ajustando parâmetros ideais
  const handleSelectLightType = (type: FakeLightType) => {
    setFakeLightType(type);
    if (type === 'spot' || type === 'plafon') {
      setFakeLightReach(120);
      setFakeLightAngle(45);
    } else {
      if (fakeLightObjectType === 'espelho') {
        setFakeLightReach(15);
        setFakeLightDirection('fora');
      } else {
        setFakeLightReach(25);
        setFakeLightDirection('baixo');
      }
    }
  };

  const handleSelectObjectType = (objType: FakeLightObjectType) => {
    setFakeLightObjectType(objType);
    if (objType === 'espelho') {
      setFakeLightReach(15);
      setFakeLightDirection('fora');
    } else {
      setFakeLightReach(25);
      setFakeLightDirection('baixo');
    }
  };

  // Ativar ferramenta interativa de luz fake no SketchUp
  const handleActivateFakeLightTool = () => {
    const config = {
      light_type: fakeLightType,
      object_type: fakeLightObjectType,
      direction: fakeLightDirection,
      color: fakeLightColor,
      reach: fakeLightReach,
      intensity: fakeLightIntensity,
      angle: fakeLightAngle,
    };

    let triggered = false;
    try {
      if ((window as any).sketchup?.ativar_ferramenta_luz_fake) {
        (window as any).sketchup.ativar_ferramenta_luz_fake(JSON.stringify(config));
        triggered = true;
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('ativar_ferramenta_luz_fake', JSON.stringify(config));
        triggered = true;
      }
    } catch (_) {}

    if (triggered) {
      if (fakeLightType === 'spot' || fakeLightType === 'plafon') {
        onToast?.('💡 Clique na face da luminária no teto (o cone desce dela com luz suave)!');
      } else if (fakeLightObjectType === 'espelho') {
        onToast?.('💡 Clique na face do espelho para contornar a borda com retroiluminação!');
      } else {
        onToast?.('💡 Clique na linha da marcenaria/sanca (segure Shift para somar linhas e Enter para gerar)!');
      }
    } else {
      onToast?.('💡 Ferramenta de Luz Fake pronta: clique na geometria no SketchUp.');
    }
  };

  // Apagar todas as luzes fake da cena
  const handleClearAllFakeLights = () => {
    setIsClearingLights(true);
    let triggered = false;
    try {
      if ((window as any).sketchup?.apagar_todas_luzes_fake) {
        (window as any).sketchup.apagar_todas_luzes_fake('');
        triggered = true;
      }
      if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('apagar_todas_luzes_fake', JSON.stringify({}));
        triggered = true;
      }
    } catch (_) {}

    setTimeout(() => setIsClearingLights(false), 800);

    if (triggered) {
      onToast?.('🗑️ Todas as luzes fake foram removidas do SketchUp com sucesso!');
    } else {
      onToast?.('🗑️ Nenhuma luz fake pendente para apagar.');
    }
  };

  // Colorir faces selecionadas com material emissivo quente (Dica de Ouro do Vídeo aos 04:08)
  const handlePaintEmissiveSelection = () => {
    setIsPaintingEmissive(true);
    let triggered = false;
    try {
      if ((window as any).sketchup?.pintar_emissivo_selecao) {
        (window as any).sketchup.pintar_emissivo_selecao(fakeLightColor);
        triggered = true;
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('pintar_emissivo_selecao', JSON.stringify({ color: fakeLightColor }));
        triggered = true;
      }
    } catch (_) {}

    setTimeout(() => setIsPaintingEmissive(false), 800);

    if (triggered) {
      onToast?.(`🎨 Faces selecionadas pintadas com tom luminoso quente (${fakeLightColor})!`);
    } else {
      onToast?.('🎨 Selecione a face do teto ou luminária no SketchUp antes de pintar.');
    }
  };

  // 1. FORMAT STATE
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    const matched = OUTPUT_FORMATS.find(f => Math.abs(f.ratio - ratio) < 0.02);
    return matched ? matched.id : '4_5';
  });
  const [customW, setCustomW] = useState<number>(width);
  const [customH, setCustomH] = useState<number>(height);

  // 2. FOCAL LENGTH STATE
  const [selectedFocalId, setSelectedFocalId] = useState<string>('35mm');
  const [customFocalLength, setCustomFocalLength] = useState<number>(50);

  // Sync incoming props
  useEffect(() => {
    setCustomW(width);
    setCustomH(height);
    const matched = OUTPUT_FORMATS.find(f => Math.abs(f.ratio - ratio) < 0.02);
    if (matched) {
      setSelectedFormatId(matched.id);
    }
  }, [ratio, width, height]);

  if (!isOpen) return null;

  // Active items
  const currentFormat = OUTPUT_FORMATS.find(f => f.id === selectedFormatId) || OUTPUT_FORMATS[0];
  const currentFocal = FOCAL_LENGTHS.find(f => f.id === selectedFocalId) || FOCAL_LENGTHS[1];
  const activeFocalMm = selectedFocalId === 'custom' ? customFocalLength : currentFocal.focalLength;
  const activeFov = selectedFocalId === 'custom' ? calculateFovFromFocalLength(customFocalLength) : currentFocal.fov;

  // Handler: Select Format
  const handleSelectFormat = (fmt: OutputFormatOption) => {
    setSelectedFormatId(fmt.id);
    const targetW = customW > 0 ? customW : fmt.defaultWidth;
    const targetH = Math.round(targetW / fmt.ratio);
    setCustomW(targetW);
    setCustomH(targetH);

    if (onUpdateFormat) {
      onUpdateFormat(fmt.ratio, targetW, targetH);
    }

    try {
      if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena(
          'definir_formato',
          JSON.stringify({
            ratio: fmt.ratio,
            width: targetW,
            height: targetH,
            label: fmt.label,
            sublabel: fmt.sublabel,
            safe_frame: safeFrame
          })
        );
      }
      if ((window as any).sketchup?.sync_overlay) {
        (window as any).sketchup.sync_overlay(
          Number(fmt.ratio),
          Number(targetW),
          Number(targetH),
          Boolean(safeFrame),
          false
        );
      }
    } catch (_) {}

    if (onToast) {
      onToast(`✓ Formato definido: ${fmt.label} (${fmt.sublabel}) - ${targetW}x${targetH}px`);
    }
  };

  // Handler: Select Focal Length
  const handleSelectFocalLength = (foc: FocalLengthOption) => {
    setSelectedFocalId(foc.id);
    const mm = foc.id === 'custom' ? customFocalLength : foc.focalLength;
    applyFocalLengthToSketchUp(mm, foc.id === 'custom' ? `Personalizado (${mm}mm)` : `${foc.label} (${foc.sublabel})`);
  };

  // Handler: Apply Custom Focal Length
  const handleCustomFocalChange = (newMm: number) => {
    const clamped = Math.max(10, Math.min(300, newMm));
    setCustomFocalLength(clamped);
    if (selectedFocalId === 'custom') {
      applyFocalLengthToSketchUp(clamped, `Custom (${clamped}mm)`);
    }
  };

  const applyFocalLengthToSketchUp = (mm: number, name: string) => {
    try {
      if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena(
          'definir_distancia_focal',
          JSON.stringify({
            focal_length: mm
          })
        );
      }
    } catch (_) {}

    if (onToast) {
      const fovVal = calculateFovFromFocalLength(mm);
      onToast(`✓ Câmera ajustada: ${name} • FOV: ${fovVal}°`);
    }
  };

  const handleApplyOptimalStyle = () => {
    try {
      if ((window as any).sketchup?.aplicar_estilo_render_ia) {
        (window as any).sketchup.aplicar_estilo_render_ia();
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena(
          'aplicar_estilo_render_ia',
          JSON.stringify({})
        );
      }
    } catch (_) {}
    if (onToast) {
      onToast('✓ Estilo IA aplicado: Sombras 11:45 (89/73), Arestas 1px (Preto), Oclusão e Texturas!');
    }
  };

  // Helper: render aspect ratio outline icon
  const renderFormatIcon = (id: string, isSelected: boolean) => {
    const borderCls = isSelected ? 'border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'border-[#94a3b8]/70 group-hover:border-white';
    switch (id) {
      case '16_9':
        return <div className={`w-6 h-3.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '1_1':
        return <div className={`w-4 h-4 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '4_5':
        return <div className={`w-3.5 h-4.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '9_16':
        return <div className={`w-2.5 h-5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '5_4':
        return <div className={`w-4.5 h-3.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '4_3':
        return <div className={`w-5 h-3.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '3_2':
        return <div className={`w-5.5 h-3.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      case '7_5':
        return <div className={`w-5 h-3.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
      default:
        return <div className={`w-4.5 h-4.5 border-2 rounded-[2px] transition-colors ${borderCls}`} />;
    }
  };

  // Helper: render focal length icon
  const renderFocalIcon = (id: string, isSelected: boolean) => {
    const iconCls = `w-4 h-4 transition-colors ${isSelected ? 'text-[#38bdf8]' : 'text-[#94a3b8] group-hover:text-white'}`;
    switch (id) {
      case '24mm':
        return <Target className={iconCls} />;
      case '35mm':
        return <Aperture className={iconCls} />;
      case '55mm':
        return <CircleDot className={iconCls} />;
      case '70mm':
        return <Focus className={iconCls} />;
      case '85mm':
        return <CircleDot className={iconCls} />;
      case 'custom':
        return <Sliders className={iconCls} />;
      default:
        return <Camera className={iconCls} />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-[620px] rounded-2xl shadow-2xl overflow-hidden border border-[#2e5d47] flex flex-col max-h-[94vh]"
        style={{
          backgroundColor: '#162e24',
          backgroundImage: 'radial-gradient(circle at 50% 0%, #1e4536 0%, #12251d 100%)',
          color: '#ffffff'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* CABEÇALHO DO MODAL */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2e5d47]/80 bg-[#12251d]/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1b3d2f] border border-[#4ade80]/40 flex items-center justify-center shadow-inner">
              <Sparkles className="w-4 h-4 text-[#4ade80]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white uppercase font-sans">
                  PREPARAR A CENA
                </h2>
              </div>
              <p className="text-[11px] text-[#a3c9b6]">
                Enquadramento e distância focal da câmera do SketchUp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CORPO ROLÁVEL */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* ========================================================================= */}
          {/* 1. SEÇÃO: FORMATO DE SAÍDA */}
          {/* ========================================================================= */}
          <div className="bg-[#173327]/90 rounded-xl border border-[#2b5843] p-3.5 shadow-sm">
            <div 
              className="flex items-center justify-between cursor-pointer group pb-2.5 border-b border-[#2b5843]/60"
              onClick={() => setIsFormatOpen(!isFormatOpen)}
            >
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-[#38bdf8]" />
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Formato de saída
                </span>
                <span className="text-[11px] font-semibold text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded-md border border-[#38bdf8]/30">
                  {currentFormat.label} ({currentFormat.sublabel})
                </span>
              </div>
              <button 
                type="button" 
                className="text-[#94a3b8] group-hover:text-white transition-colors"
                title={isFormatOpen ? 'Recolher seção' : 'Expandir seção'}
              >
                {isFormatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isFormatOpen && (
              <div className="mt-3 space-y-3">
                {/* GRADE DE 8 BOTÕES (4 colunas x 2 linhas) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {OUTPUT_FORMATS.map((fmt) => {
                    const isSelected = fmt.id === selectedFormatId;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => handleSelectFormat(fmt)}
                        className={`group relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#153a2f] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-[#38bdf8]'
                            : 'bg-[#183629]/70 hover:bg-[#1f4534] border-[#2d5c46] hover:border-[#3d7a5c]'
                        }`}
                        title={`${fmt.label} (${fmt.sublabel}) - ${fmt.description}`}
                      >
                        <div className="h-6 flex items-center justify-center mb-1.5">
                          {renderFormatIcon(fmt.id, isSelected)}
                        </div>
                        <span className={`text-xs font-bold leading-tight transition-colors ${
                          isSelected ? 'text-[#38bdf8]' : 'text-gray-200 group-hover:text-white'
                        }`}>
                          {fmt.label}
                        </span>
                        <span className={`text-[10px] font-medium leading-tight mt-0.5 ${
                          isSelected ? 'text-[#7dd3fc]' : 'text-[#8cb8a1] group-hover:text-gray-300'
                        }`}>
                          {fmt.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* PAINEL DE PARÂMETROS DO FORMATO */}
                <div className="p-3 rounded-lg bg-[#11241c] border border-[#274f3c] text-xs space-y-2">
                  <div className="flex items-center justify-between text-[#8cb8a1]">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#38bdf8]" /> Parâmetros do Formato:
                    </span>
                    <span className="text-[10px] text-[#38bdf8] font-mono">
                      Ratio: {currentFormat.ratio.toFixed(4)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Proporção</span>
                      <strong className="text-white">{currentFormat.sublabel}</strong>
                    </div>
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Resolução</span>
                      <strong className="text-[#4ade80]">{customW} × {customH} px</strong>
                    </div>
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Moldura (Safe Frame)</span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer mt-0.5">
                        <input
                          type="checkbox"
                          checked={safeFrame}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (onToggleSafeFrame) onToggleSafeFrame(checked);
                            try {
                              if ((window as any).sketchup?.sync_overlay) {
                                (window as any).sketchup.sync_overlay(
                                  Number(currentFormat.ratio),
                                  Number(customW),
                                  Number(customH),
                                  Boolean(checked),
                                  false
                                );
                              }
                            } catch (_) {}
                            if (onToast) onToast(checked ? '✓ Moldura ativada no SketchUp' : 'Moldura desativada');
                          }}
                          className="w-3.5 h-3.5 accent-[#38bdf8] cursor-pointer"
                        />
                        <span className="text-white text-[10px] font-bold">
                          {safeFrame ? 'ATIVA' : 'DESL.'}
                        </span>
                      </label>
                    </div>
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Aplicação</span>
                      <span className="text-white font-medium truncate block" title={currentFormat.usage}>
                        {currentFormat.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 2. SEÇÃO: DISTÂNCIA FOCAL */}
          {/* ========================================================================= */}
          <div className="bg-[#173327]/90 rounded-xl border border-[#2b5843] p-3.5 shadow-sm">
            <div 
              className="flex items-center justify-between cursor-pointer group pb-2.5 border-b border-[#2b5843]/60"
              onClick={() => setIsFocalOpen(!isFocalOpen)}
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#38bdf8]" />
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Distância Focal
                </span>
                <span className="text-[11px] font-semibold text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded-md border border-[#38bdf8]/30">
                  {selectedFocalId === 'custom' ? `${customFocalLength}mm (Custom)` : `${currentFocal.label} • ${currentFocal.sublabel}`}
                </span>
              </div>
              <button 
                type="button" 
                className="text-[#94a3b8] group-hover:text-white transition-colors"
                title={isFocalOpen ? 'Recolher seção' : 'Expandir seção'}
              >
                {isFocalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isFocalOpen && (
              <div className="mt-3 space-y-3">
                {/* GRADE DE 6 BOTÕES (3 colunas x 2 linhas) */}
                <div className="grid grid-cols-3 gap-2">
                  {FOCAL_LENGTHS.map((foc) => {
                    const isSelected = foc.id === selectedFocalId;
                    const displayLabel = foc.id === 'custom' && selectedFocalId === 'custom' ? `${customFocalLength}mm` : foc.label;
                    return (
                      <button
                        key={foc.id}
                        type="button"
                        onClick={() => handleSelectFocalLength(foc)}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#153a2f] border-[#38bdf8] shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-[#38bdf8]'
                            : 'bg-[#183629]/70 hover:bg-[#1f4534] border-[#2d5c46] hover:border-[#3d7a5c]'
                        }`}
                        title={`${foc.label} - ${foc.type}`}
                      >
                        <div className="h-6 flex items-center justify-center mb-1.5">
                          {renderFocalIcon(foc.id, isSelected)}
                        </div>
                        <span className={`text-xs sm:text-sm font-bold leading-tight transition-colors ${
                          isSelected ? 'text-[#38bdf8]' : 'text-gray-200 group-hover:text-white'
                        }`}>
                          {displayLabel}
                        </span>
                        <span className={`text-[10px] font-medium leading-tight mt-0.5 ${
                          isSelected ? 'text-[#7dd3fc]' : 'text-[#8cb8a1] group-hover:text-gray-300'
                        }`}>
                          {foc.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* CONTROLE DESLIZANTE QUANDO "CUSTOM" ESTIVER ATIVO */}
                {selectedFocalId === 'custom' && (
                  <div className="p-3 bg-[#11241c] rounded-xl border border-[#38bdf8]/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="flex items-center gap-1.5 text-[#38bdf8]">
                        <Sliders className="w-3.5 h-3.5" /> Ajuste Fino da Distância Focal:
                      </span>
                      <span className="px-2 py-0.5 bg-[#173327] rounded border border-[#38bdf8]/40 text-[#38bdf8] font-mono">
                        {customFocalLength} mm
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#8cb8a1]">12mm</span>
                      <input
                        type="range"
                        min={12}
                        max={200}
                        step={1}
                        value={customFocalLength}
                        onChange={(e) => handleCustomFocalChange(parseInt(e.target.value, 10))}
                        className="flex-1 accent-[#38bdf8] cursor-pointer"
                      />
                      <span className="text-[10px] text-[#8cb8a1]">200mm</span>
                    </div>
                  </div>
                )}

                {/* PAINEL DE PARÂMETROS DA LENTE */}
                <div className="p-3 rounded-lg bg-[#11241c] border border-[#274f3c] text-xs space-y-2">
                  <div className="flex items-center justify-between text-[#8cb8a1]">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[#38bdf8]" /> Parâmetros Ópticos da Lente:
                    </span>
                    <span className="text-[10px] text-[#4ade80] font-mono font-bold">
                      FOV: ~{activeFov}°
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Distância Focal</span>
                      <strong className="text-[#38bdf8]">{activeFocalMm} mm</strong>
                    </div>
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843]">
                      <span className="text-[#8cb8a1] block text-[10px]">Ângulo de Visão</span>
                      <strong className="text-white">~{activeFov}° (Horizontal)</strong>
                    </div>
                    <div className="bg-[#173327] p-2 rounded-md border border-[#2b5843] col-span-2 sm:col-span-1">
                      <span className="text-[#8cb8a1] block text-[10px]">Tipo de Lente</span>
                      <span className="text-white font-semibold truncate block">
                        {currentFocal.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 3: REFLEXO DE SUPERFÍCIE (ESPELHO, PISO, TV, VIDRO, BRONZE, FUMÊ) */}
          {/* ========================================================================= */}
          <div className="border border-[#2a5540] rounded-xl overflow-hidden bg-[#162e22] shadow-sm">
            <button
              type="button"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className="w-full px-4 py-3 bg-[#183628] hover:bg-[#1d4231] transition-colors flex items-center justify-between text-left cursor-pointer border-b border-[#2a5540]"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#10b981]/20 border border-[#10b981]/40 text-[#34d399]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    3. Reflexo de Superfície
                  </h3>
                  <p className="text-[11px] text-[#8cb8a1]">
                    Espelhos, pisos, telas de TV, vidros, bronze e fumê com reconhecimento interativo de face
                  </p>
                </div>
              </div>
              <div className="text-[#8cb8a1]">
                {isToolsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isToolsOpen && (
              <div className="p-4 space-y-4 bg-[#14291e]">
                
                {/* 1. Grade de Presets (Espelho, Piso, TV, Vidro, Bronze, Fumê) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#bbf7d0] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Tipo de Superfície</span>
                    </span>
                    <span className="text-[10px] text-stone-300 font-medium">
                      {SURFACE_PRESETS.find(p => p.id === selectedReflectType)?.desc}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {SURFACE_PRESETS.map((p) => {
                      const isSelected = selectedReflectType === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectReflectPreset(p.id)}
                          className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer font-semibold text-xs ${
                            isSelected
                              ? 'bg-[#10b981] border-[#34d399] text-white shadow-md shadow-[#10b981]/25 scale-[1.02]'
                              : 'bg-[#11241c] border-[#224433] text-stone-300 hover:bg-[#183628] hover:border-[#387356]'
                          }`}
                        >
                          <span className="text-base">{p.icon}</span>
                          <span className="text-[11px]">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Sliders de Ajuste Fino */}
                <div className="p-3 bg-[#102219] rounded-xl border border-[#224433] space-y-3">
                  {/* Escurecimento / Tom */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-300 flex items-center gap-1 font-medium">
                        <Sliders className="w-3 h-3 text-[#10b981]" />
                        Escurecimento / Tom
                      </span>
                      <span className="font-mono text-[#34d399] font-bold bg-[#0d1c14] px-2 py-0.5 rounded border border-[#224433]">
                        {reflectDarkening}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={reflectDarkening}
                      onChange={(e) => setReflectDarkening(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0d1c14] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                    />
                    <div className="flex justify-between text-[9px] text-stone-400">
                      <span>0% (Incolor / Cristalino)</span>
                      <span>100% (Preto Absoluto)</span>
                    </div>
                  </div>

                  {/* Opacidade do Reflexo */}
                  <div className="space-y-1.5 pt-2 border-t border-[#1a3829]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-300 flex items-center gap-1 font-medium">
                        <Eye className="w-3 h-3 text-[#10b981]" />
                        Opacidade do Reflexo
                      </span>
                      <span className="font-mono text-[#34d399] font-bold bg-[#0d1c14] px-2 py-0.5 rounded border border-[#224433]">
                        {reflectOpacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={reflectOpacity}
                      onChange={(e) => setReflectOpacity(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0d1c14] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                    />
                    <div className="flex justify-between text-[9px] text-stone-400">
                      <span>5% (Leve e sutil)</span>
                      <span>100% (Espelho Total)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Botões de Ação: Gerar na Cena + Apagar Todos */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleActivateReflectTool}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/25 hover:shadow-[#10b981]/40 transition-all cursor-pointer border border-[#34d399]/40 active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-100" />
                    <span>🪞 Gerar Reflexo na Cena (Clique na Face)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleFixReflectColors}
                      disabled={isFixingColors}
                      className="py-2 px-2 rounded-lg bg-[#182a20] hover:bg-[#203629] text-emerald-200 hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 border border-[#2a5540] transition cursor-pointer disabled:opacity-50"
                      title="Restaura reflexos existentes para cores reais se estiverem desbotados ou preto e branco"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isFixingColors ? 'Restaurando cores...' : '🎨 Restaurar Cores Reais'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAllReflects}
                      disabled={isClearingReflects}
                      className="py-2 px-2 rounded-lg bg-[#182a20] hover:bg-[#203629] text-stone-300 hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 border border-[#2a5540] transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isClearingReflects ? 'Limpando...' : '🗑️ Apagar reflexos'}</span>
                    </button>
                  </div>
                </div>

                {/* 4. Guia Rápido de Uso Interativo */}
                <div className="p-3 bg-[#102219] rounded-xl border border-[#224433] space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#34d399] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Como usar o reconhecimento interativo:</span>
                  </div>
                  <p className="text-[10.5px] text-stone-300 leading-relaxed">
                    1. Posicione sua câmera no SketchUp e clique em <strong>"Gerar Reflexo na Cena"</strong> acima.<br />
                    2. Passe o mouse sobre a face do espelho, TV ou piso: <span className="text-[#34d399] font-bold">ela acenderá em verde esmeralda!</span><br />
                    3. Dê <strong>1 clique</strong> com o botão esquerdo para criar a projeção do reflexo.<br />
                    4. Segure <strong>Shift</strong> para selecionar múltiplas faces e aperte <strong>ESC</strong> para sair.
                  </p>
                  <div className="pt-1.5 border-t border-[#1a3829] text-[10px] text-[#8cb8a1] flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-[#10b981]" />
                    <span>Cria um grupo overlay seguro e elevado em 0.5mm — não altera seus blocos originais!</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 4. LUZ FAKE (ILUMINAÇÃO IA - SPOTS, MARCENARIA, ESPELHOS & FITAS DE LED)  */}
          {/* ========================================================================= */}
          <div className="border border-[#224433] rounded-2xl overflow-hidden bg-[#102219] shadow-lg">
            <button
              type="button"
              onClick={() => setIsFakeLightOpen(!isFakeLightOpen)}
              className="w-full p-4 bg-[#14291e] hover:bg-[#1c3a2a] transition flex items-center justify-between cursor-pointer border-b border-[#224433]/80 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#142e22] border border-[#10b981]/40 flex items-center justify-center text-[#bbf7d0] shadow-sm shadow-[#10b981]/20">
                  <Sun className="w-4 h-4 text-[#10b981]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>4. Luz Fake (Iluminação IA)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#34d399] font-semibold">
                      Novo • Destaque
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-200/70">
                    Fitas de LED em marcenaria e espelhos, spots de teto e iluminação emissiva
                  </p>
                </div>
              </div>
              <div className="text-emerald-200/70">
                {isFakeLightOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {isFakeLightOpen && (
              <div className="p-4 space-y-4 bg-[#14291e]">
                
                {/* 1. SELEÇÃO PRINCIPAL: FITA DE LED vs SPOT */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-[#34d399] uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#10b981]" />
                    <span>Tipo de Iluminação</span>
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectLightType('fita_led')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 transition-all cursor-pointer font-semibold text-xs ${
                        fakeLightType === 'fita_led'
                          ? 'bg-[#10b981] border-[#34d399] text-white shadow-md shadow-[#10b981]/30 font-bold'
                          : 'bg-[#11241c] border-[#224433] text-emerald-100 hover:bg-[#1c3a2a]'
                      }`}
                    >
                      <Sliders className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <div className="text-xs">Fita LED</div>
                        <div className={`text-[10px] ${fakeLightType === 'fita_led' ? 'text-white' : 'text-stone-400'}`}>
                          Móveis e Sancas
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectLightType('spot')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 transition-all cursor-pointer font-semibold text-xs ${
                        fakeLightType === 'spot'
                          ? 'bg-[#10b981] border-[#34d399] text-white shadow-md shadow-[#10b981]/30 font-bold'
                          : 'bg-[#11241c] border-[#224433] text-emerald-100 hover:bg-[#1c3a2a]'
                      }`}
                    >
                      <Sun className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <div className="text-xs">Spot Luz</div>
                        <div className={`text-[10px] ${fakeLightType === 'spot' ? 'text-white' : 'text-stone-400'}`}>
                          Facho Redondo
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectLightType('plafon')}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2.5 transition-all cursor-pointer font-semibold text-xs ${
                        fakeLightType === 'plafon'
                          ? 'bg-[#10b981] border-[#34d399] text-white shadow-md shadow-[#10b981]/30 font-bold'
                          : 'bg-[#11241c] border-[#224433] text-emerald-100 hover:bg-[#1c3a2a]'
                      }`}
                    >
                      <Layers className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <div className="text-xs">Plafon</div>
                        <div className={`text-[10px] ${fakeLightType === 'plafon' ? 'text-white' : 'text-stone-400'}`}>
                          Luz Quadrada
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. SUB-OPÇÕES QUANDO FITA DE LED (TIPO DE OBJETO E DIREÇÃO) */}
                {fakeLightType === 'fita_led' && (
                  <div className="p-3 bg-[#102219] rounded-xl border border-[#224433] space-y-3">
                    {/* Tipo de Objeto: Marcenaria vs Espelho */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-200 font-medium">Aplicar em:</span>
                        <span className="text-[10px] text-[#10b981]/80">
                          {fakeLightObjectType === 'marcenaria' ? 'Sancas, nichos e móveis' : 'Retroiluminação perimetral'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectObjectType('marcenaria')}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            fakeLightObjectType === 'marcenaria'
                              ? 'bg-[#10b981] border-[#34d399] text-white font-bold shadow-sm shadow-[#10b981]/30'
                              : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                          }`}
                        >
                          <span>🪵 Marcenaria / Sanca</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectObjectType('espelho')}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            fakeLightObjectType === 'espelho'
                              ? 'bg-[#10b981] border-[#34d399] text-white font-bold shadow-sm shadow-[#10b981]/30'
                              : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                          }`}
                        >
                          <span>🪞 Espelho (Borda)</span>
                        </button>
                      </div>
                    </div>

                    {/* Direção do Facho */}
                    <div className="space-y-1.5 pt-2 border-t border-[#224433]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-200 font-medium">Direção da Projeção de Luz:</span>
                        <span className="text-[10px] text-[#34d399] font-mono uppercase">
                          {fakeLightDirection}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {fakeLightObjectType === 'marcenaria' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('baixo')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'baixo'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↓ Baixo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('cima')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'cima'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↑ Cima
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('esquerda')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'esquerda'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ← Esquerda
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('direita')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'direita'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              → Direita
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('duplo')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'duplo'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↕ Duplo
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('fora')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'fora'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↗ Para Fora (Halo)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('dentro')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'dentro'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↙ Para Dentro
                            </button>
                            <button
                              type="button"
                              onClick={() => setFakeLightDirection('duplo')}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                                fakeLightDirection === 'duplo'
                                  ? 'bg-[#059669] border-[#34d399] text-white font-bold'
                                  : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                              }`}
                            >
                              ↔ Duplo (Halo Total)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TEMPERATURA / COR DA LUZ */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#34d399] uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[#10b981]" />
                      <span>Temperatura e Cor da Luz</span>
                    </span>
                    <span className="text-[10px] text-[#10b981] font-mono font-bold bg-[#11241c] px-2 py-0.5 rounded border border-[#224433]">
                      {fakeLightColor}
                    </span>
                  </div>

                  {/* Presets Rápidos */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {FAKE_LIGHT_COLOR_PRESETS.map((preset) => {
                      const isSelected = fakeLightColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setFakeLightColor(preset.hex)}
                          className={`py-1.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#10b981] border-white text-white font-bold shadow-md shadow-[#10b981]/30 scale-[1.02]'
                              : 'bg-[#0d1c14] border-[#224433] text-stone-300 hover:bg-[#183628]'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-stone-800 shadow-sm"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span className="text-[10px] font-medium leading-none">{preset.label}</span>
                          <span className="text-[8px] opacity-75 leading-none">{preset.kelvin}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Seletor Customizado Hex / Color Picker */}
                  <div className="flex items-center gap-2 p-2 bg-[#0d1c14] rounded-xl border border-[#224433]">
                    <div className="relative flex items-center">
                      <input
                        type="color"
                        value={fakeLightColor}
                        onChange={(e) => setFakeLightColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-stone-700 cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="flex-1 text-[11px] text-stone-300">
                      <span>Cor personalizada ou digite o código Hex:</span>
                    </div>
                    <input
                      type="text"
                      value={fakeLightColor}
                      onChange={(e) => setFakeLightColor(e.target.value)}
                      placeholder="#ffe7ae"
                      maxLength={7}
                      className="w-24 px-2 py-1 bg-[#05110b] border border-[#224433] rounded-lg text-xs font-mono text-[#34d399] text-center uppercase"
                    />
                  </div>
                </div>

                {/* 4. SLIDERS DE AJUSTE (ALCANCE, INTENSIDADE, ÂNGULO) */}
                <div className="p-3 bg-[#102219] rounded-xl border border-[#224433] space-y-3">
                  {/* Alcance / Comprimento do Facho */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-200 flex items-center gap-1 font-medium">
                        <Sliders className="w-3 h-3 text-[#10b981]" />
                        {fakeLightType === 'spot' ? 'Alcance / Altura do Cone' : 'Alcance / Projeção do Facho'}
                      </span>
                      <span className="font-mono text-[#34d399] font-bold bg-[#0d1c14] px-2 py-0.5 rounded border border-[#224433]">
                        {fakeLightReach} cm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={fakeLightType === 'spot' ? 30 : (fakeLightObjectType === 'espelho' ? 5 : 10)}
                      max={fakeLightType === 'spot' ? 300 : (fakeLightObjectType === 'espelho' ? 40 : 80)}
                      value={fakeLightReach}
                      onChange={(e) => setFakeLightReach(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0d1c14] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                    />
                    <div className="flex justify-between text-[9px] text-stone-400">
                      <span>{fakeLightType === 'spot' ? '30cm (Foco curto)' : 'Curto e suave'}</span>
                      <span>{fakeLightType === 'spot' ? '300cm (Pé direito alto)' : 'Amplo espalhamento'}</span>
                    </div>
                  </div>

                  {/* Intensidade / Brilho */}
                  <div className="space-y-1.5 pt-2 border-t border-[#1a3829]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-200 flex items-center gap-1 font-medium">
                        <Sun className="w-3 h-3 text-[#10b981]" />
                        Intensidade do Brilho
                      </span>
                      <span className="font-mono text-[#34d399] font-bold bg-[#0d1c14] px-2 py-0.5 rounded border border-[#224433]">
                        {fakeLightIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={fakeLightIntensity}
                      onChange={(e) => setFakeLightIntensity(Number(e.target.value))}
                      className="w-full h-1.5 bg-[#0d1c14] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                    />
                    <div className="flex justify-between text-[9px] text-stone-400">
                      <span>10% (Sutil e translúcido)</span>
                      <span>100% (Vibrante / Foco forte)</span>
                    </div>
                  </div>

                  {/* Se Spot: Ângulo de Abertura */}
                  {fakeLightType === 'spot' && (
                    <div className="space-y-1.5 pt-2 border-t border-[#1a3829]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-200 flex items-center gap-1 font-medium">
                          <Aperture className="w-3 h-3 text-[#10b981]" />
                          Ângulo de Abertura do Cone
                        </span>
                        <span className="font-mono text-[#34d399] font-bold bg-[#0d1c14] px-2 py-0.5 rounded border border-[#224433]">
                          {fakeLightAngle}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="75"
                        value={fakeLightAngle}
                        onChange={(e) => setFakeLightAngle(Number(e.target.value))}
                        className="w-full h-1.5 bg-[#0d1c14] rounded-lg appearance-none cursor-pointer accent-[#10b981]"
                      />
                      <div className="flex justify-between text-[9px] text-stone-400">
                        <span>15° (Foco fechado)</span>
                        <span>75° (Abertura ampla / Flood)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. BOTÃO PRINCIPAL DE GERAÇÃO */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleActivateFakeLightTool}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/25 hover:shadow-[#10b981]/40 transition-all cursor-pointer border border-[#34d399]/40 active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 text-emerald-100 fill-emerald-100" />
                    <span>
                      {fakeLightType === 'spot'
                        ? '⚡ Gerar Spot Fake (Clique na Luminária do Teto)'
                        : fakeLightObjectType === 'espelho'
                        ? '⚡ Gerar Fita no Espelho (Clique na Face)'
                        : '⚡ Gerar Fita de LED (Clique na Linha da Sanca/Móvel)'}
                    </span>
                  </button>

                  {/* Ações Complementares: Pintar Emissivo + Apagar Todas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePaintEmissiveSelection}
                      disabled={isPaintingEmissive}
                      className="py-2 px-3 rounded-lg bg-[#182a20] hover:bg-[#203629] text-[#34d399] hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 border border-[#2a5540] transition cursor-pointer disabled:opacity-50"
                      title="Pinta as faces selecionadas no teto com tom quente luminoso (#ffe7ae)"
                    >
                      <PaintBucket className="w-3.5 h-3.5 text-[#10b981]" />
                      <span>{isPaintingEmissive ? 'Pintando...' : '🎨 Pintar Seleção com Luz Amarela'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAllFakeLights}
                      disabled={isClearingLights}
                      className="py-2 px-3 rounded-lg bg-[#182a20] hover:bg-[#203629] text-stone-300 hover:text-white font-medium text-[11px] flex items-center justify-center gap-1.5 border border-[#2a5540] transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isClearingLights ? 'Apagando luzes...' : '🗑️ Apagar todas as luzes fake'}</span>
                    </button>
                  </div>
                </div>

                {/* 6. GUIA DIDÁTICO DINÂMICO CONFORME O VÍDEO */}
                <div className="p-3 bg-[#102219] rounded-xl border border-[#224433] space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#10b981] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Como usar a Luz Fake no SketchUp:</span>
                  </div>
                  {fakeLightType === 'spot' ? (
                    <p className="text-[10.5px] text-stone-300 leading-relaxed">
                      1. Clique em <strong>"Gerar Spot Fake"</strong> acima.<br />
                      2. Clique na face circular ou vidro do spot no teto: <span className="text-[#34d399] font-bold">o cone translúcido se projeta para baixo instantaneamente!</span><br />
                      3. Segure <strong>Shift</strong> para ir clicando em outros spots consecutivos pela cena.<br />
                      4. Pressione <strong>ESC</strong> para finalizar.
                    </p>
                  ) : fakeLightObjectType === 'espelho' ? (
                    <p className="text-[10.5px] text-stone-300 leading-relaxed">
                      1. Clique em <strong>"Gerar Fita no Espelho"</strong> acima.<br />
                      2. Dê <strong>1 clique</strong> sobre a face do espelho: <span className="text-[#34d399] font-bold">o contorno de LED e o halo suave se ajustam 2mm atrás da borda</span> acompanhando todo o formato!<br />
                      3. Pressione <strong>ESC</strong> para sair.
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-stone-300 leading-relaxed">
                      1. Clique em <strong>"Gerar Fita de LED"</strong> acima.<br />
                      2. Passe o mouse sobre a linha/aresta da sanca ou móvel (a linha acenderá em verde).<br />
                      3. Dê <strong>1 clique</strong> para gerar imediatamente, ou segure <strong>Shift</strong> para somar múltiplas linhas contínuas e aperte <strong>ENTER</strong> para gerar todas juntas!<br />
                      4. Pressione <strong>ESC</strong> para cancelar.
                    </p>
                  )}
                  <div className="pt-1.5 border-t border-[#1a3829] text-[10px] text-[#34d399]/80 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#10b981]" />
                    <span>Dica do Vídeo: A IA renderiza luzes volumétricas e sancas perfeitas quando encontra essas referências amarelas quentes!</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RODAPÉ DO MODAL - Reduzido apenas para informação de Sincronização */}
        {/* ========================================================================= */}
        <div className="px-5 py-3 border-t border-[#2e5d47] bg-[#12251d]/90 flex items-center justify-center">
          <div className="flex items-center gap-1.5 text-[11px] text-[#a3c9b6]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>Sincronizado com SketchUp</span>
          </div>
        </div>
      </div>
    </div>
  );
};
