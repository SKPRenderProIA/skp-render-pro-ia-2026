import React, { useState, useEffect, useRef } from 'react';
import { Message, RenderConfig, DetectedMaterial, BatchSceneItem } from './types';
import { Language, translations } from './locales';
import { Gallery } from './components/Gallery';
import { GemIcon, OrangeGemIcon, PurpleGemIcon, InstagramIcon, WhatsAppIcon, BrFlag, UsFlag, EsFlag } from './components/Icons';
import { CameraOverlay } from './components/CameraOverlay';
import { LicenseManagerModal } from './components/LicenseManagerModal';
import { ScenePrepModal, OUTPUT_FORMATS } from './components/ScenePrepModal';
import { SketchUpActivationLock } from './components/SketchUpActivationLock';
import { MaterialsEditorModal } from './components/MaterialsEditorModal';
import { Panorama360Modal } from './components/Panorama360Modal';
import { Panorama360PopoutView } from './components/Panorama360PopoutView';
import { BatchScenesModal } from './components/BatchScenesModal';
import { SKP_PLUGIN_STABLE_CODE } from './data/skpPluginSource';
import { Copy, Check, Sparkles, ExternalLink, Camera, Pencil, RotateCw, Key, KeyRound, Lock, X, ShieldAlert, AlertTriangle, RefreshCw, Download, Palette, ChevronUp, ChevronDown, Maximize2, Compass, Image as ImageIcon } from 'lucide-react';

export default function App() {
  // State for camera and rendering configuration
  const [ratio, setRatio] = useState<number>(0.8); // 4:5 (Insta) default
  const [width, setWidth] = useState<number>(2000);
  const [height, setHeight] = useState<number>(2500); // 2000 / 0.8 = 2500
  const [safeFrame, setSafeFrame] = useState<boolean>(true); // Ativada automaticamente por padrão ao abrir o plugin
  const [showOverlayModal, setShowOverlayModal] = useState<boolean>(false);
  const [showLicenseModal, setShowLicenseModal] = useState<boolean>(false);
  const [showScenePrepModal, setShowScenePrepModal] = useState<boolean>(false);
  const [showPanorama360Modal, setShowPanorama360Modal] = useState<boolean>(false);
  const [showGalleryModal, setShowGalleryModal] = useState<boolean>(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isCapturing360, setIsCapturing360] = useState<boolean>(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState<boolean>(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState<boolean>(false);
  const [batchScenes, setBatchScenes] = useState<BatchSceneItem[]>([]);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  // Modo Janela Externa / Pop-out fora do plugin
  const isPopoutMaterialsMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('popout') === 'materials' ||
    window.location.search.includes('popout=materials') ||
    window.location.href.includes('popout=materials')
  );
  const isPopoutPanorama360Mode = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('popout') === 'panorama360' || new URLSearchParams(window.location.search).get('popout') === '360');

  // Detecta se está sendo executado no plugin do SketchUp e o ID da máquina
  const skpPcId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('skp_pcid') : null;
  
  // Detecção estrita e contínua do ambiente do SketchUp (HtmlDialog / CEF / parâmetros de inicialização)
  const checkIsInsideSketchup = () => {
    if (typeof window === 'undefined') return false;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSkpParam = Boolean(
      searchParams.get('skp_pcid') || 
      searchParams.get('skp') || 
      searchParams.get('sketchup') ||
      searchParams.get('inside_skp')
    );
    const hasSkpObject = Boolean((window as any).sketchup);
    const hasSkpUserAgent = typeof navigator !== 'undefined' && /sketchup/i.test(navigator.userAgent || '');
    return hasSkpParam || hasSkpObject || hasSkpUserAgent;
  };

  const [isSketchupDetected, setIsSketchupDetected] = useState<boolean>(checkIsInsideSketchup);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('skp_ui_language');
    if (saved === 'pt' || saved === 'en' || saved === 'es') return saved;
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === 'pt') return 'pt';
    if (browserLang === 'es') return 'es';
    return 'en';
  });

  const t = translations[language];

  useEffect(() => {
    if (checkIsInsideSketchup()) {
      setIsSketchupDetected(true);
    }
    // Polling rápido durante os primeiros segundos para capturar a injeção assíncrona do window.sketchup pelo CEF
    const interval = setInterval(() => {
      if (checkIsInsideSketchup()) {
        setIsSketchupDetected(true);
      }
    }, 200);
    const timer = setTimeout(() => clearInterval(interval), 4000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, []);

  // Sincroniza o idioma com o localStorage
  useEffect(() => {
    localStorage.setItem('skp_ui_language', language);
  }, [language]);

  // Fecha o menu de idioma ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estados de versão do Plugin
  const [pluginVersion, setPluginVersion] = useState<number>(0);
  const [hasPluginUpdate, setHasPluginUpdate] = useState<boolean>(false);

  // Monitoramento de Versão do Plugin Ruby para Alerta de Atualização
  useEffect(() => {
    const checkPluginVersion = async () => {
      try {
        const res = await fetch(`/api/plugin-version?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.version) {
            const serverVer = Number(data.version);
            setPluginVersion(serverVer);

            // REGRA: Se o administrador NÃO ativou o alerta no servidor, NUNCA exibe o botão laranja!
            if (!data.activeAlert) {
              setHasPluginUpdate(false);
              return;
            }

            // Se o alerta está ativo, verifica se o usuário já instalou/baixou esta versão
            const localVer = localStorage.getItem('skp_plugin_installed_version') || localStorage.getItem('skp_plugin_local_version');
            if (!localVer || Number(localVer) < serverVer) {
              setHasPluginUpdate(true);
            } else {
              setHasPluginUpdate(false);
            }
          }
        }
      } catch (_) {}
    };
    
    checkPluginVersion();
    // Verifica atualizações a cada 2 minutos
    const intervalVersion = setInterval(checkPluginVersion, 120000);
    return () => clearInterval(intervalVersion);
  }, []);

  // Listener para quando o plugin for salvo com sucesso no SketchUp
  useEffect(() => {
    const handlePluginSaved = () => {
      const currentVer = pluginVersion || Date.now();
      localStorage.setItem('skp_plugin_installed_version', currentVer.toString());
      localStorage.setItem('skp_plugin_local_version', currentVer.toString());
      setHasPluginUpdate(false);
    };
    window.addEventListener('skp-plugin-saved-direct', handlePluginSaved);
    return () => window.removeEventListener('skp-plugin-saved-direct', handlePluginSaved);
  }, [pluginVersion]);

  const isInsideSketchup = Boolean(isSketchupDetected || (typeof window !== 'undefined' && checkIsInsideSketchup()));

  // Estado de Bloqueio e Ativação de Licença no SketchUp
  const [licenseBlocked, setLicenseBlocked] = useState<boolean>(false);
  const [licenseBlockedReason, setLicenseBlockedReason] = useState<string>('');
  const [isLicenseChecking, setIsLicenseChecking] = useState<boolean>(Boolean(skpPcId));

  const verifySketchupStatus = async () => {
    if (!skpPcId) return;
    setIsLicenseChecking(true);
    try {
      const res = await fetch(`/api/license/check-status?pcId=${encodeURIComponent(skpPcId)}&t=${Date.now()}`);
      const data = await res.json();
      if (data.active === true) {
        setLicenseBlocked(false);
        setLicenseBlockedReason('');
        // Se houver licença ativa cadastrada, sincroniza com o registro local do SketchUp
        if (data.licenseKey && (window as any).sketchup?.atualizar_chave_ativada) {
          try {
            (window as any).sketchup.atualizar_chave_ativada(data.licenseKey);
          } catch (_) {}
        }
      } else {
        setLicenseBlocked(true);
        setLicenseBlockedReason(data.message || 'Licença não cadastrada ou excluída.');
      }
    } catch (e) {
      console.warn('Falha ao verificar status de licença online:', e);
    } finally {
      setIsLicenseChecking(false);
    }
  };

  useEffect(() => {
    if (skpPcId) {
      verifySketchupStatus();
    }
  }, [skpPcId]);

  // Toast feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ia',
      text: translations[language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en'].welcome,
    },
  ]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [input, setInput] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string>('');
  const [attachedImageMeta, setAttachedImageMeta] = useState<{
    isImported: boolean;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [detectedMaterials, setDetectedMaterials] = useState<DetectedMaterial[]>([]);
  const [isDetectingMaterials, setIsDetectingMaterials] = useState<boolean>(false);
  const [lightingReport, setLightingReport] = useState<string>('');

  // Edit message & re-generation state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Estados de Interface Ajustável com PERSISTÊNCIA em localStorage
  const [headerHeight, setHeaderHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skp_ui_header_height');
      if (saved) return Math.max(20, Math.min(400, Number(saved)));
    } catch (_) {}
    return 135;
  });
  const [configHeight, setConfigHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skp_ui_config_height');
      if (saved) return Math.max(55, Math.min(260, Number(saved)));
    } catch (_) {}
    return 95;
  });
  const [footerHeight, setFooterHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skp_ui_footer_height');
      if (saved) return Math.max(38, Math.min(500, Number(saved)));
    } catch (_) {}
    return 140;
  });
  const [isResizingHeader, setIsResizingHeader] = useState(false);
  const [isResizingConfig, setIsResizingConfig] = useState(false);
  const [isResizingFooter, setIsResizingFooter] = useState(false);

  // Logo personalizado do cabeçalho com persistência em localStorage
  const [customHeaderLogo, setCustomHeaderLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('skp_ui_custom_logo') || null;
    } catch (_) {
      return null;
    }
  });
  const headerLogoInputRef = useRef<HTMLInputElement>(null);

  // Efeitos para salvar automaticamente qualquer ajuste feito na máquina do usuário
  useEffect(() => {
    try {
      localStorage.setItem('skp_ui_header_height', String(headerHeight));
    } catch (_) {}
  }, [headerHeight]);

  useEffect(() => {
    try {
      localStorage.setItem('skp_ui_config_height', String(configHeight));
    } catch (_) {}
  }, [configHeight]);

  useEffect(() => {
    try {
      localStorage.setItem('skp_ui_footer_height', String(footerHeight));
    } catch (_) {}
  }, [footerHeight]);

  // Upload e remoção da logo personalizada do cabeçalho
  const handleHeaderLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomHeaderLogo(result);
        try {
          localStorage.setItem('skp_ui_custom_logo', result);
        } catch (_) {}
        showToast('✓ Imagem do cabeçalho atualizada com sucesso!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetHeaderLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomHeaderLogo(null);
    try {
      localStorage.removeItem('skp_ui_custom_logo');
    } catch (_) {}
    showToast('✓ Imagem padrão do cabeçalho restaurada!');
  };

  // Handlers para redimensionamento com limites ultracompactos
  const startResizingHeader = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeader(true);
    const startY = e.clientY;
    const startHeight = headerHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      setHeaderHeight(Math.max(20, Math.min(400, startHeight + delta)));
    };

    const onMouseUp = () => {
      setIsResizingHeader(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingConfig = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingConfig(true);
    const startY = e.clientY;
    const startHeight = configHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      // Permite diminuir até 55px (ultra-compacto): todos os itens se adaptam dinamicamente
      setConfigHeight(Math.max(55, Math.min(260, startHeight + delta)));
    };

    const onMouseUp = () => {
      setIsResizingConfig(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingFooter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingFooter(true);
    const startY = e.clientY;
    const startHeight = footerHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      setFooterHeight(Math.max(38, Math.min(500, startHeight + delta)));
    };

    const onMouseUp = () => {
      setIsResizingFooter(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Monitora a rolagem para exibir o botão flutuante de descer ao final se o usuário tiver subido
  const handleChatScroll = () => {
    const container = chatAreaRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottomBtn(distanceFromBottom > 220);
  };

  // Show temporary toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Aplica o Estilo Ideal para IA nas cenas do SketchUp (Sombras 11:45, Claro 89 / Escuro 73, Arestas 1px, Oclusão e Texturas)
  const handleApplyOptimalStyle = () => {
    try {
      if ((window as any).sketchup?.aplicar_estilo_render_ia) {
        (window as any).sketchup.aplicar_estilo_render_ia();
      } else if ((window as any).sketchup?.executar_comando_cena) {
        (window as any).sketchup.executar_comando_cena('aplicar_estilo_render_ia', JSON.stringify({}));
      }
    } catch (_) {}
    showToast('✓ Estilo IA aplicado: Sombras 11:45 (89/73), Arestas 1px (Preto), Oclusão e Texturas!');
  };

  // Gerar Espelho & Reflexos de Superfície com Reconhecimento Interativo no SketchUp
  const handleGerarEspelho = () => {
    setShowScenePrepModal(true);
  };

  // Toggle expansion for long chat messages
  const toggleMessageExpansion = (msgId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // Helper de cópia ultra-robusto com preservação estrita de UTF-8 e acentuação (ã, é, ó, ç, etc.)
  const handleCopyText = async (text: string, idRef?: string) => {
    if (!text) return;
    
    // Normalização Unicode (NFC) para garantir que caracteres acentuados sejam representados de forma unificada
    const cleanText = typeof text.normalize === 'function' ? text.normalize('NFC') : text;
    let copied = false;

    // 1. API Moderna de Clipboard (se disponível no contexto atual)
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(cleanText);
        copied = true;
      } catch (_) {}
    }

    // 2. Método Universal: DataTransfer explícito com charset UTF-8 nativo via evento de cópia
    if (!copied) {
      try {
        const copyHandler = (e: ClipboardEvent) => {
          e.preventDefault();
          if (e.clipboardData) {
            e.clipboardData.clearData();
            e.clipboardData.setData('text/plain', cleanText);
          }
        };
        document.addEventListener('copy', copyHandler);
        copied = document.execCommand('copy');
        document.removeEventListener('copy', copyHandler);
      } catch (_) {}
    }

    // 3. Fallback de textarea síncrono para WebViews restritivas
    if (!copied) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = cleanText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        textArea.remove();
      } catch (_) {}
    }

    // 4. Ponte com o SketchUp: SOMENTE acionamos se o navegador NÃO conseguiu copiar (copied === false).
    // NUNCA chamamos se o browser já copiou com sucesso, para evitar que a API legada ANSI do SketchUp
    // sobrescreva a área de transferência com caracteres corrompidos.
    if (!copied) {
      try {
        if ((window as any).sketchup?.copiar_prompt) {
          (window as any).sketchup.copiar_prompt(cleanText);
        }
      } catch (_) {}
    }

    if (idRef) {
      setCopiedId(idRef);
      setTimeout(() => setCopiedId(null), 2500);
    }
    showToast('✓ Prompt copiado para a área de transferência!');
  };

  // Helper para renderizar o prompt arquitetônico com formatação rica e limpa (SISTEMA MESTRE e blocos)
  const renderFormattedPrompt = (text: string) => {
    if (!text) return null;
    const cleanText = text
      .replace(/^\[PROMPT_START\]\s*/i, '')
      .replace(/\s*\[PROMPT_END\]$/i, '')
      .trim();

    const lines = cleanText.split('\n');
    let insideCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';

    const renderedElements: React.ReactNode[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();

      // Controle de blocos de código ```text ou ```json
      if (trimmed.startsWith('```')) {
        if (!insideCodeBlock) {
          insideCodeBlock = true;
          codeBlockLang = trimmed.replace(/^```/, '').trim();
          codeBlockContent = [];
        } else {
          insideCodeBlock = false;
          const codeText = codeBlockContent.join('\n');
          const blockId = `code-block-${idx}`;
          renderedElements.push(
            <div key={`code-${idx}`} className="my-2 rounded-md bg-[#1e293b] text-[#e2e8f0] p-3 text-[11.5px] font-mono leading-relaxed overflow-x-auto border border-stone-700/60 shadow-inner">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#94a3b8] tracking-wider mb-1.5 pb-1 border-b border-slate-700/50">
                <span>{codeBlockLang || 'PROMPT'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(codeText, blockId)}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-sans flex items-center gap-1 cursor-pointer transition active:scale-95 border border-slate-600"
                  title="Copiar apenas este bloco"
                >
                  {copiedId === blockId ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === blockId ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap select-text">{codeText}</pre>
            </div>
          );
          codeBlockContent = [];
        }
        continue;
      }

      if (insideCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      if (!trimmed) {
        renderedElements.push(<div key={`blank-${idx}`} className="h-1.5" />);
        continue;
      }

      // Linha divisória ---
      if (trimmed === '---') {
        renderedElements.push(
          <hr key={`hr-${idx}`} className="my-2.5 border-t border-stone-200/90" />
        );
        continue;
      }

      // Título de Identificação / Mensagem do Usuário: # A1 GERAR
      if (trimmed.startsWith('# ')) {
        const titleText = trimmed.replace(/^#\s+/, '');
        renderedElements.push(
          <div
            key={`h1-${idx}`}
            className="font-extrabold text-[#113222] text-[13.5px] py-1.5 px-2.5 bg-[#eaf3ee] border border-[#a2bba9] rounded-md tracking-wide flex items-center justify-between shadow-xs mb-2"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#1b4e36]" />
              <span className="tracking-wide">{titleText}</span>
            </div>
            <span className="text-[10px] font-bold text-[#2d5a45] bg-white/90 px-2 py-0.5 rounded border border-[#b2c8b8] uppercase">
              INICIAL FIXADA
            </span>
          </div>
        );
        continue;
      }

      // Título de Seção Oficial: ### SEÇÃO 1 — IMAGEM ANALISADA
      if (trimmed.startsWith('### ')) {
        const titleText = trimmed.replace(/^###\s+/, '');
        renderedElements.push(
          <div
            key={`sec-${idx}`}
            className="font-bold text-[#143023] text-[13px] pt-3 pb-1 tracking-wide flex items-center gap-1.5 border-b border-stone-200/80 mb-1"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-[#2d5a45]" />
            <span>{titleText}</span>
          </div>
        );
        continue;
      }

      // Títulos secundários ## ou ####
      if (trimmed.startsWith('## ') || trimmed.startsWith('#### ')) {
        const titleText = trimmed.replace(/^#+\s+/, '');
        renderedElements.push(
          <div key={`h-${idx}`} className="font-bold text-[#1f2937] text-[12.5px] pt-2 pb-0.5 tracking-wide">
            {titleText}
          </div>
        );
        continue;
      }

      // Títulos legados com colchetes: [LEITURA FORENSE...], [TRAVA TOTAL...]
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        renderedElements.push(
          <div key={`bracket-${idx}`} className="font-bold text-[#1f2937] text-[13px] pt-2 pb-0.5 tracking-wide">
            {trimmed}
          </div>
        );
        continue;
      }

      // Itens com asterisco e negrito: * **Identificação da Cena:** ... ou - **Piso / Pavimentação:**
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        const indentSpaces = line.search(/\S/);
        const indentLevel = indentSpaces > 3 ? 2 : indentSpaces > 1 ? 1 : 0;
        const paddingClass = indentLevel === 2 ? 'pl-8' : indentLevel === 1 ? 'pl-5' : 'pl-2';
        const withoutBullet = trimmed.replace(/^[\*\-]\s*/, '');
        // Verifica se tem **Label:**
        const boldMatch = withoutBullet.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
        if (boldMatch) {
          const [, label, rest] = boldMatch;
          renderedElements.push(
            <div key={`item-${idx}`} className={`${paddingClass} py-0.5 text-[11.5px] leading-relaxed`}>
              <span className="font-bold text-stone-900">{label}:</span>{' '}
              <span className="text-stone-700">{rest}</span>
            </div>
          );
          continue;
        }

        const colonIndex = withoutBullet.indexOf(':');
        if (colonIndex !== -1) {
          const label = withoutBullet.substring(0, colonIndex + 1);
          const rest = withoutBullet.substring(colonIndex + 1);
          renderedElements.push(
            <div key={`item-${idx}`} className={`${paddingClass} py-0.5 text-[11.5px] leading-relaxed`}>
              <span className="font-semibold text-stone-900">{label}</span>
              <span className="text-stone-700">{rest}</span>
            </div>
          );
          continue;
        }

        renderedElements.push(
          <div key={`item-${idx}`} className={`${paddingClass} py-0.5 text-[11.5px] leading-relaxed text-stone-700`}>
            • {withoutBullet}
          </div>
        );
        continue;
      }

      // Linha normal de texto com possível formatação inline de negrito
      if (trimmed.includes('**')) {
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        renderedElements.push(
          <div key={`line-${idx}`} className="py-0.5 text-stone-800">
            {parts.map((p, pIdx) => {
              if (p.startsWith('**') && p.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-semibold text-stone-900">
                    {p.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{p}</span>;
            })}
          </div>
        );
        continue;
      }

      // Linha normal pura
      renderedElements.push(
        <div key={`text-${idx}`} className="py-0.5 text-stone-800">
          {trimmed}
        </div>
      );
    }

    return (
      <div className="space-y-0.5 text-[12.5px] leading-relaxed text-stone-800 select-text font-sans">
        {renderedElements}
      </div>
    );
  };

  // Helper to save image directly to computer with strict resolution and aspect ratio
  const downloadImageWithExactResolution = async (
    dataUrl: string,
    targetW?: number,
    targetH?: number,
    baseName = 'SKP_Print'
  ) => {
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const natW = img.naturalWidth || img.width || 2000;
      const natH = img.naturalHeight || img.height || 2500;

      // Se targetW e targetH não foram informados ou forem <= 0, preserva 100% a dimensão REAL nativa da própria imagem
      const isOriginalSize = (!targetW || targetW <= 0) && (!targetH || targetH <= 0);
      const w = isOriginalSize ? natW : (targetW && targetW > 0 ? targetW : natW);
      const h = isOriginalSize ? natH : (targetH && targetH > 0 ? targetH : natH);

      // Se for dimensão nativa original, baixa diretamente sem reprocessar no canvas (zero distorção, zero perda)
      if (isOriginalSize) {
        if ((window as any).sketchup?.salvar_print) {
          (window as any).sketchup.salvar_print(dataUrl, `${baseName}_${natW}x${natH}.jpg`);
          return;
        }
        handleDownloadImage(dataUrl, `${baseName}_${natW}x${natH}.jpg`);
        showToast(`✓ Imagem salva na sua dimensão real de ${natW}x${natH}px!`);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context error');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Se estiver no SketchUp, aciona o callback nativo de salvar arquivo
      try {
        if ((window as any).sketchup?.salvar_print) {
          const exactDataUrl = canvas.toDataURL('image/jpeg', 0.96);
          (window as any).sketchup.salvar_print(exactDataUrl, `${baseName}_${canvas.width}x${canvas.height}.jpg`);
          return;
        }
      } catch (_) {}

      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${baseName}_${canvas.width}x${canvas.height}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast(`✓ Imagem salva no computador em ${canvas.width}x${canvas.height}px!`);
      }, 'image/jpeg', 0.96);
    } catch (e) {
      handleDownloadImage(dataUrl, `${baseName}.jpg`);
    }
  };

  // Copy Image (Print or Render) to Clipboard strictly with exact target resolution
  const handleCopyImage = async (dataUrl: string, idTag?: string, targetW?: number, targetH?: number) => {
    let copiedViaBridge = false;

    // Garante foco na janela para autorização de clipboard no navegador/CEF
    try {
      window.focus();
    } catch (_) {}

    // 1. No SketchUp: dispara a cópia nativa via Ruby (PowerShell no Windows / AppleScript no Mac)
    // Isso garante que a imagem real seja colada no Windows com 100% de sucesso sem restrições de navegador
    try {
      if ((window as any).sketchup && typeof (window as any).sketchup.copiar_imagem === 'function') {
        (window as any).sketchup.copiar_imagem(dataUrl);
        copiedViaBridge = true;
      }
    } catch (_) {}

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined') {
        throw new Error('Clipboard API não suportada');
      }

      // IMPORTANTE: Criamos a Promise do Blob DENTRO do ClipboardItem.
      // Isso permite que navigator.clipboard.write seja acionado no exato momento do clique,
      // impedindo que o Chromium expire o "Transient User Gesture" durante o processamento da imagem.
      const blobPromise = new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const natW = img.naturalWidth || img.width || 2000;
            const natH = img.naturalHeight || img.height || 2500;
            const isOriginalSize = (!targetW || targetW <= 0) && (!targetH || targetH <= 0);
            const w = isOriginalSize ? natW : (targetW && targetW > 0 ? targetW : natW);
            const h = isOriginalSize ? natH : (targetH && targetH > 0 ? targetH : natH);

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w);
            canvas.height = Math.round(h);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error('Falha ao gerar blob'));
            }, 'image/png');
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem para cópia'));
        img.src = dataUrl;
      });

      // Dispara imediatamente no gesto de clique para passar na validação de segurança do Chromium
      const item = new ClipboardItem({
        'image/png': blobPromise
      });

      await navigator.clipboard.write([item]);

      if (idTag) {
        setCopiedId(idTag);
        setTimeout(() => setCopiedId(null), 2500);
      }
      showToast('✓ Imagem copiada com sucesso! Pressione Ctrl+V no Gemini.');
    } catch (err: any) {
      console.warn('[COPY IMAGE ERROR]', err);
      if (copiedViaBridge) {
        if (idTag) {
          setCopiedId(idTag);
          setTimeout(() => setCopiedId(null), 2500);
        }
        showToast('✓ Imagem copiada via SketchUp! Pressione Ctrl+V.');
      } else {
        showToast('⚠️ Para copiar sem restrições, atualize o plugin no botão acima ou use o botão "SALVAR" ao lado.');
      }
    }
  };

  // Main action: Copy Prompt from UI
  const handleCopyPromptAction = () => {
    // 1. If user has text in input textarea
    if (input.trim()) {
      handleCopyText(input.trim(), 'global-btn');
      return;
    }

    // 2. Find the latest master prompt or IA message with prompt
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.masterPrompt) {
        handleCopyText(msg.masterPrompt, 'global-btn');
        return;
      }
      if (msg.text && msg.text.includes('`') && msg.text.includes('Prompt')) {
        const matches = msg.text.match(/`([^`]+)`/);
        if (matches && matches[1]) {
          handleCopyText(matches[1], 'global-btn');
          return;
        }
      }
      if (msg.sender === 'user' && msg.text) {
        handleCopyText(msg.text, 'global-btn');
        return;
      }
    }

    // 4. Fallback default official prompt
    const defaultPrompt = 'Transforme este print 3D do SketchUp em uma fotografia arquitetônica real e indistinguível de uma foto de obra construída, mantendo a posição exata da câmera, o layout do projeto e as texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista.';
    handleCopyText(defaultPrompt, 'global-btn');
  };

  // Open Gemini Gem inside SketchUp dialog or new tab
  const handleOpenGemini = () => {
    const gemUrl = 'https://gemini.google.com/gem/1G2t4Otxm7RqE88jeaVMh3862abPxfqdh?usp=sharing';
    try {
      if ((window as any).sketchup?.abrir_gem) {
        (window as any).sketchup.abrir_gem(gemUrl);
        showToast('✓ Abrindo Gemini Gem dentro do SketchUp...');
      } else {
        window.open(gemUrl, '_blank');
      }
    } catch (_) {
      window.open(gemUrl, '_blank');
    }
  };

  // Download RB Plugin file (works both in browser and inside SketchUp)
  const handleDownloadRb = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    showToast('⏳ Preparando plugin protegido skp_render_pro_protected.rb...');

    try {
      // 1. Prioridade: Obter código protegido/ofuscado diretamente via endpoint seguro
      let rubyCode = '';
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const serverParam = currentOrigin && !currentOrigin.includes('ais-pre-') && !currentOrigin.includes('ais-dev-') 
        ? `&serverUrl=${encodeURIComponent(currentOrigin)}` 
        : `&serverUrl=${encodeURIComponent('http://localhost:3000')}`;

      try {
        const resJson = await fetch(`/api/plugin-code?type=protected&t=${Date.now()}${serverParam}`);
        if (resJson.ok) {
          const contentType = resJson.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await resJson.json();
            if (data && data.success && data.code) {
              rubyCode = data.code;
            }
          }
        }
      } catch (_) {}

      // Fallback para download raw do arquivo protegido se necessário
      if (!rubyCode) {
        try {
          const resRaw = await fetch(`/api/download/skp_render_pro_protected.rb?type=protected&t=${Date.now()}${serverParam}`);
          if (resRaw.ok) {
            const text = await resRaw.text();
            if (text && !text.trim().startsWith('<') && !text.includes('<!doctype')) {
              rubyCode = text;
            }
          }
        } catch (_) {}
      }

      // Validador estrito de código Ruby: detecta HTML ou respostas corrompidas de proxies
      const isValidRuby = (code?: string): boolean => {
        if (!code || typeof code !== 'string') return false;
        const trimmed = code.trim();
        if (trimmed.length < 200) return false;
        if (trimmed.startsWith('<')) return false;
        const header = trimmed.slice(0, 300).toLowerCase();
        if (header.includes('<!doctype') || header.includes('<html') || header.includes('302 found') || header.includes('__cookie_check')) {
          return false;
        }
        return trimmed.includes('SKPRenderPro') || trimmed.includes('module ') || trimmed.includes('require') || trimmed.includes('eval(Zlib');
      };

      // Se a resposta for vazia, HTML ou inválida, usa o código oficial completo protegido e estável embutido
      if (!isValidRuby(rubyCode)) {
        console.warn('[DOWNLOAD RB] Aplicando base oficial protegida/ofuscada embutida.');
        rubyCode = SKP_PLUGIN_STABLE_CODE;
      }

      // SE ESTIVER DENTRO DO SKETCHUP:
      // Salva DIRETO na pasta oficial de plugins do SketchUp usando a janela nativa já aberta na pasta Plugins!
      if (isInsideSketchup) {
        // Envia o código Ruby limpo diretamente, sem prefixos ou codificação intermediária
        if ((window as any).sketchup?.salvar_plugin_direto) {
          (window as any).sketchup.salvar_plugin_direto(rubyCode);
        } else if ((window as any).sketchup?.baixar_rb) {
          (window as any).sketchup.baixar_rb(rubyCode);
        }
        showToast('📂 Janela aberta diretamente na pasta Plugins do seu SketchUp!');
        if (pluginVersion > 0) {
          localStorage.setItem('skp_plugin_installed_version', pluginVersion.toString());
          localStorage.setItem('skp_plugin_local_version', pluginVersion.toString());
          setHasPluginUpdate(false);
        }
        return;
      }

      // Se NÃO estiver dentro do SketchUp (download em navegador externo como Chrome/Edge):
      const blob = new Blob([rubyCode], { type: 'text/x-ruby;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = 'skp_render_pro_protected.rb';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1500);

      // Marca a versão atual como "lida/instalada" para remover o alerta visual
      if (pluginVersion > 0) {
        localStorage.setItem('skp_plugin_installed_version', pluginVersion.toString());
        localStorage.setItem('skp_plugin_local_version', pluginVersion.toString());
        setHasPluginUpdate(false);
      }

      showToast('✓ Plugin protegido (skp_render_pro_protected.rb) baixado! Substitua na pasta Plugins do seu SketchUp.');
    } catch (err: any) {
      console.error('[DOWNLOAD RB ERROR]', err);
      // Fallback de emergência absoluto com código protegido
      try {
        const fallbackBlob = new Blob([SKP_PLUGIN_STABLE_CODE], { type: 'text/x-ruby;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(fallbackBlob);
        const fbLink = document.createElement('a');
        fbLink.href = fallbackUrl;
        fbLink.download = 'skp_render_pro_protected.rb';
        document.body.appendChild(fbLink);
        fbLink.click();
        setTimeout(() => {
          if (document.body.contains(fbLink)) document.body.removeChild(fbLink);
          URL.revokeObjectURL(fallbackUrl);
        }, 1500);
        showToast('✓ Plugin protegido (skp_render_pro_protected.rb) baixado com sucesso!');
      } catch (fbErr: any) {
        showToast('⚠️ Erro ao baixar plugin: ' + (fbErr?.message || 'Falha no download'));
      }
    }
  };

  // Open Admin Panel with security password verification (31542066)
  const handleOpenAdminPanel = () => {
    if (isAdminUnlocked) {
      setShowLicenseModal(true);
    } else {
      setAdminPasswordInput('');
      setPasswordError(null);
      setShowPasswordPrompt(true);
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === '31542066') {
      setIsAdminUnlocked(true);
      setShowPasswordPrompt(false);
      setShowLicenseModal(true);
      setPasswordError(null);
    } else {
      setPasswordError('Senha incorreta.');
    }
  };

  // Calculate height whenever width or ratio changes
  const calc = (newWidth: number, newRatio: number) => {
    if (newRatio > 0 && newWidth > 0) {
      const calculatedHeight = Math.round(newWidth / newRatio);
      setHeight(calculatedHeight);
    }
  };

  const handleRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setRatio(val);
    const matched = OUTPUT_FORMATS.find(f => Math.abs(f.ratio - val) < 0.02);
    if (matched) {
      const targetW = width > 0 ? width : matched.defaultWidth;
      const targetH = Math.round(targetW / matched.ratio);
      setWidth(targetW);
      setHeight(targetH);
      sync(matched.ratio, targetW, targetH, safeFrame);
      try {
        if ((window as any).sketchup?.executar_comando_cena) {
          (window as any).sketchup.executar_comando_cena('definir_formato', JSON.stringify({
            ratio: matched.ratio,
            width: targetW,
            height: targetH,
            label: matched.label,
            sublabel: matched.sublabel,
            safe_frame: safeFrame
          }));
        }
      } catch (_) {}
      showToast(`✓ Proporção: ${matched.label} (${matched.sublabel}) - ${targetW}x${targetH}px`);
    } else {
      calc(width, val);
      sync(val, width, Math.round(width / val), safeFrame);
    }
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setWidth(val);
    calc(val, ratio);
    sync(ratio, val, Math.round(val / ratio), safeFrame);
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setHeight(val);
    if (val > 0 && width > 0) {
      const calculatedRatio = Number((width / val).toFixed(4));
      setRatio(calculatedRatio);
      sync(calculatedRatio, width, val, safeFrame);
    }
  };

  // Helper to ensure any image strictly obeys the aspect ratio and frame specified in width and height
  const cropDataUrlToRatio = (
    dataUrl: string,
    targetW: number,
    targetH: number,
    targetRatioVal?: number
  ): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return resolve(dataUrl);
      }
      const desiredRatio = targetW > 0 && targetH > 0 
        ? targetW / targetH 
        : (targetRatioVal && targetRatioVal > 0 ? targetRatioVal : 0.8);

      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        const currentRatio = srcW / srcH;

        const outW = targetW > 0 ? targetW : Math.round(srcH * desiredRatio);
        const outH = targetH > 0 ? targetH : Math.round(outW / desiredRatio);

        // Se a imagem já estiver rigorosamente na proporção da moldura E com a resolução exata de Largura x Altura
        if (Math.abs(currentRatio - desiredRatio) < 0.005 && srcW === outW && srcH === outH) {
          return resolve(dataUrl);
        }

        // Corta rigorosamente com base na moldura central (Safe Frame)
        let cropW = srcW;
        let cropH = srcH;
        let cropX = 0;
        let cropY = 0;

        if (currentRatio > desiredRatio) {
          cropH = srcH;
          cropW = srcH * desiredRatio;
          cropX = (srcW - cropW) / 2;
          cropY = 0;
        } else {
          cropW = srcW;
          cropH = srcW / desiredRatio;
          cropX = 0;
          cropY = (srcH - cropH) / 2;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(outW);
        canvas.height = Math.round(outH);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Rolagem para o final ultra-robusta (evita congelamento em navegadores embutidos / SketchUp CEF)
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = chatAreaRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      // 1. Rolagem direta no container (funciona 100% no CEF e Web sem travar)
      try {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        });
      } catch (_) {
        container.scrollTop = container.scrollHeight;
      }

      // 2. Se for 'auto' ou para assegurar fim do scroll após renderização completa
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        setTimeout(() => {
          if (container) {
            const maxScroll = container.scrollHeight - container.clientHeight;
            if (maxScroll > 0 && container.scrollTop < maxScroll - 15) {
              container.scrollTop = container.scrollHeight;
            }
          }
        }, 160);
      }

      // 3. Garante que o elemento sentinela também entre em visão
      if (messagesEndRef.current) {
        try {
          messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        } catch (_) {}
      }
    });
  };

  // Scroll ao final quando chegam novas mensagens ou muda o estado de carregamento
  useEffect(() => {
    scrollToBottom('smooth');
    const t1 = setTimeout(() => scrollToBottom('smooth'), 50);
    const t2 = setTimeout(() => scrollToBottom('smooth'), 150);
    const t3 = setTimeout(() => scrollToBottom('auto'), 350);
    const t4 = setTimeout(() => scrollToBottom('auto'), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [messages, isLoading]);

  // MutationObserver: Garante que o chat role pra cima automaticamente sempre que o texto do prompt
  // formatado terminar de renderizar ou qualquer print/imagem for inserido no DOM
  useEffect(() => {
    const container = chatAreaRef.current;
    if (!container) return;

    let debounceTimer: any = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 450;
        if (isNearBottom || isLoading) {
          scrollToBottom('smooth');
        }
      }, 50);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [isLoading]);

  // Helper to optimize any dataUrl string (downsampling & compression) to avoid CEF memory crash in SketchUp
  const optimizeDataUrl = (dataUrl: string, maxDim = 8000, quality = 0.88): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return resolve(dataUrl);
      }
      if (dataUrl.startsWith('data:image/jpeg') && dataUrl.length < 500000) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const is360 = Math.abs(width / height - 2.0) < 0.1 || (width >= 4000 && height >= 2000);
        const effectiveMax = is360 ? 8000 : maxDim;
        if (width > effectiveMax || height > effectiveMax) {
          if (width > height) {
            height = Math.round((height * effectiveMax) / width);
            width = effectiveMax;
          } else {
            width = Math.round((width * effectiveMax) / height);
            height = effectiveMax;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Safe image download without page navigation
  const handleDownloadImage = (dataUrl: string, filename?: string) => {
    try {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename || `SKP_Render_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('✓ Imagem baixada com sucesso!');
    } catch (e) {
      console.warn('Erro ao baixar imagem:', e);
    }
  };

  // Helper to optimize image if needed, strictly preserving native aspect ratio and resolution
  const compressImage = (file: File): Promise<{ dataUrl: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const natW = img.naturalWidth || img.width;
          const natH = img.naturalHeight || img.height;

          // Se for panorama 360 (2:1 ou resolução alta), preserva até 8000x4000
          const is360 = Math.abs(natW / natH - 2.0) < 0.1 || (natW >= 4000 && natH >= 2000);
          const maxDimension = is360 ? 8000 : 4096;

          // Se a imagem for menor que 8MB e dimensão razoável (até maxDimension), preserva 100% o arquivo original sem recriar no canvas
          if (file.size < 8 * 1024 * 1024 && natW <= maxDimension && natH <= maxDimension) {
            resolve({ dataUrl: rawDataUrl, width: natW, height: natH });
            return;
          }

          let width = natW;
          let height = natH;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: rawDataUrl, width: natW, height: natH });
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(mime, 0.92);
          resolve({ dataUrl: compressedDataUrl, width, height });
        };
        img.onerror = () => resolve({ dataUrl: rawDataUrl, width: 2000, height: 2500 });
        img.src = rawDataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle local image selection from computer (+ IMG)
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, etc.).');
      return;
    }
    try {
      const { dataUrl, width: imgW, height: imgH } = await compressImage(file);
      setAttachedImage(dataUrl);
      setAttachedImageName(file.name);
      setAttachedImageMeta({
        isImported: true,
        naturalWidth: imgW,
        naturalHeight: imgH,
      });
      // Limpa materiais do print anterior para não misturar com a nova imagem em espera
      setDetectedMaterials([]);
      updateInputWithMaterials([]);
      syncMaterialsBroadcast([], dataUrl);
      showToast(`✓ Imagem importada com dimensão real: ${imgW}x${imgH}px!`);
    } catch (err) {
      console.error('Error loading image:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const testImg = new Image();
        testImg.onload = () => {
          const nw = testImg.naturalWidth || testImg.width || 2000;
          const nh = testImg.naturalHeight || testImg.height || 2000;
          setAttachedImage(result);
          setAttachedImageName(file.name);
          setAttachedImageMeta({
            isImported: true,
            naturalWidth: nw,
            naturalHeight: nh,
          });
          setDetectedMaterials([]);
          updateInputWithMaterials([]);
          syncMaterialsBroadcast([], result);
          showToast(`✓ Imagem importada com dimensão real: ${nw}x${nh}px!`);
        };
        testImg.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
    // Reset file input value so same file can be chosen again if needed
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImageName('');
    setAttachedImageMeta(null);
    setDetectedMaterials([]);
    updateInputWithMaterials([]);
    syncMaterialsBroadcast([], null);
  };

  // Importação e processamento em lote de múltiplas cenas do mesmo ambiente
  const handleBatchFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    showToast(`⏳ Importando ${fileList.length} cena(s) para o lote...`);
    const newItems: BatchSceneItem[] = [];
    const availableCodes = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10', 'L11', 'M12', 'N13', 'O14', 'P15'];
    const currentCount = batchScenes.length;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const { dataUrl, width: imgW, height: imgH } = await compressImage(file);
        const codeIndex = (currentCount + i) % availableCodes.length;
        newItems.push({
          id: `batch-scene-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          image: dataUrl,
          name: file.name.replace(/\.[^/.]+$/, ''),
          sceneCode: availableCodes[codeIndex],
          width: imgW,
          height: imgH,
          ratio: imgW && imgH ? imgW / imgH : 0.8,
        });
      } catch (err) {
        console.warn('Erro ao processar imagem para lote:', err);
      }
    }

    if (newItems.length > 0) {
      setBatchScenes((prev) => [...prev, ...newItems]);
      showToast(`✓ ${newItems.length} cena(s) adicionada(s) ao lote de mesmo ambiente!`);
    }
  };

  const handleCaptureSkpForBatch = async () => {
    if (attachedImage) {
      const availableCodes = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9', 'J10', 'L11', 'M12', 'N13', 'O14', 'P15'];
      const codeIndex = batchScenes.length % availableCodes.length;
      const newItem: BatchSceneItem = {
        id: `batch-scene-${Date.now()}`,
        image: attachedImage,
        name: attachedImageName || `Cena ${availableCodes[codeIndex]} SketchUp`,
        sceneCode: availableCodes[codeIndex],
        width: attachedImageMeta?.naturalWidth || width,
        height: attachedImageMeta?.naturalHeight || height,
        ratio: attachedImageMeta?.naturalWidth && attachedImageMeta?.naturalHeight ? (attachedImageMeta.naturalWidth / attachedImageMeta.naturalHeight) : ratio,
      };
      setBatchScenes((prev) => [...prev, newItem]);
      showToast(`✓ Print em espera adicionado como ${availableCodes[codeIndex]} ao lote!`);
      return;
    }

    await handleCaptureSketchUp();
    showToast('📸 Cena capturada! Clique em "++" para gerenciar o lote.');
  };

  const handleApplyBatchToChat = (batch: BatchSceneItem[], masterMaterialsText: string) => {
    const newChatMessages: Message[] = [];
    const timestamp = Date.now();

    if (masterMaterialsText) {
      newChatMessages.push({
        id: `batch-master-${timestamp}`,
        sender: 'ia',
        text: `🏛️ LEITURA UNIFICADA DO AMBIENTE EM LOTE (${batch.length} CENAS)\n\nTodos os materiais e iluminação abaixo foram travados e unificados para que todo o ambiente mantenha exatamente a mesma paleta, o mesmo tom de madeira/MDF, mesma textura de piso e iluminação em todos os ângulos.\n\n${masterMaterialsText}`,
      });
    }

    batch.forEach((scene, idx) => {
      if (scene.generatedPrompt) {
        newChatMessages.push({
          id: `batch-scene-${timestamp}-${idx}`,
          sender: 'user',
          text: `# ${scene.sceneCode} GERAR\nCena ${idx + 1} do Lote Uniforme (${scene.name || scene.sceneCode})`,
          image: scene.image,
          imageWidth: scene.width || 2000,
          imageHeight: scene.height || 2500,
          isImported: true,
        });

        newChatMessages.push({
          id: `batch-ia-${timestamp}-${idx}`,
          sender: 'ia',
          text: `✓ Prompt da Cena ${scene.sceneCode} com Materiais 100% Uniformes:`,
          masterPrompt: scene.generatedPrompt,
          imageWidth: scene.width || 2000,
          imageHeight: scene.height || 2500,
          isImported: true,
        });
      }
    });

    if (newChatMessages.length > 0) {
      setMessages((prev) => [...prev, ...newChatMessages]);
      scrollToBottom('smooth');
    }
  };

  // Drag and drop image onto message box (suporta arquivo único ou lote)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 1) {
      handleBatchFiles(e.dataTransfer.files);
      setShowBatchModal(true);
    } else {
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Helper to format materials as architectural bullet points for prompt
  const formatMaterialsForPrompt = (mats: DetectedMaterial[]): string => {
    if (!mats || mats.length === 0) return '';
    const lines = mats.map((m) => `• ${m.element}: ${m.description}`).join('\n');
    return `Materiais e Objetos da cena:\n${lines}`;
  };

  // Synchronize detected materials directly into the message box input
  const updateInputWithMaterials = (mats: DetectedMaterial[]) => {
    setInput((prev) => {
      const matBlock = formatMaterialsForPrompt(mats);
      // Remove any existing Materiais block (with or without #, duplicated or not)
      const cleanPrev = prev.replace(/(?:#+\s*)?Materiais (?:e Objetos )?da cena:[\s\S]*?(?=(?:\n{2,}#)|(?:\n{2,}[A-Za-z0-9_]+(?:\s+GERAR)?)|$)/gi, '').trim();
      if (!matBlock) {
        return cleanPrev;
      }
      if (!cleanPrev) {
        return matBlock;
      }
      return `${cleanPrev}\n\n${matBlock}`;
    });
  };

  // Sincronizador para Janela Externa (BroadcastChannel + LocalStorage)
  const syncMaterialsBroadcast = (mats: DetectedMaterial[], img?: string | null) => {
    // SEMPRE prioriza o print que está em espera (attachedImage) quando disponível
    const activeImg = img !== undefined ? img : (attachedImage || null);
    const payload = {
      materials: mats,
      image: activeImg,
      imageName: attachedImageName || (attachedImage ? 'Print em Espera' : 'Cena 3D SketchUp'),
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem('skp_materials_sync', JSON.stringify(payload));
    } catch (_) {}
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('skp_materials_channel');
        bc.postMessage(payload);
        bc.close();
      }
    } catch (_) {}
  };

  // Sincronização em tempo real entre a Janela Externa e o Plugin do SketchUp
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('skp_materials_sync');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.materials) && parsed.materials.length > 0 && detectedMaterials.length === 0) {
          setDetectedMaterials(parsed.materials);
        }
        if (parsed.image && isPopoutMaterialsMode) {
          setAttachedImage(parsed.image);
          if (parsed.imageName) {
            setAttachedImageName(parsed.imageName);
          }
        }
      }
    } catch (_) {}

    const handleSyncData = (data: any) => {
      if (!data) return;
      if (Array.isArray(data.materials)) {
        setDetectedMaterials(data.materials);
        if (!isPopoutMaterialsMode) {
          updateInputWithMaterials(data.materials);
        }
      }
      // Sempre atualiza o print da cena para refletir o print atual em espera
      if (data.image !== undefined) {
        setAttachedImage(data.image);
        if (data.imageName) {
          setAttachedImageName(data.imageName);
        }
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'skp_materials_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleSyncData(parsed);
        } catch (_) {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('skp_materials_channel');
        bc.onmessage = (ev) => {
          handleSyncData(ev.data);
        };
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
    };
  }, [isPopoutMaterialsMode]);

  // Permitir recarregar o plugin no SketchUp pressionando F5 ou Ctrl+R
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        try {
          window.location.reload();
        } catch (_) {
          window.location.href = window.location.href;
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Abrir nova interface dedicada de Materiais e Objetos DENTRO DO SKETCHUP (UI::HtmlDialog)
  const handleOpenMaterialsInSketchup = async (customImg?: string) => {
    // O print em espera para ser enviado (attachedImage) é SEMPRE prioridade máxima!
    let activeImg = attachedImage || customImg;
    if (!activeImg) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].image) {
          activeImg = messages[i].image;
          break;
        }
      }
    }

    // Se ainda não temos materiais detectados (ou novo print em espera) e há imagem, dispara leitura profunda
    if (detectedMaterials.length === 0 && activeImg && !isDetectingMaterials) {
      handleDetectMaterials(activeImg);
    } else if (activeImg || detectedMaterials.length > 0) {
      syncMaterialsBroadcast(detectedMaterials, activeImg);
    }

    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    const popoutUrl = `${currentOrigin}${currentPath}?popout=materials&inside_skp=1&skp=1${skpPcId ? `&skp_pcid=${encodeURIComponent(skpPcId)}` : ''}&v=${Date.now()}&_b=${Math.random().toString(36).substring(2)}`;

    // 1. Tenta acionar a nova ação nativa no SketchUp (UI::HtmlDialog dedicado)
    if ((window as any).sketchup?.abrir_dialogo_materiais) {
      try {
        (window as any).sketchup.abrir_dialogo_materiais(popoutUrl);
        showToast('✓ Janela de Materiais e Objetos aberta dentro do SketchUp!');
        return;
      } catch (err) {
        console.warn('Falha em abrir_dialogo_materiais:', err);
      }
    }

    // 2. Fallback nativo: abrir_gem (já disponível em todas as versões do plugin Ruby e abre UI::HtmlDialog dentro do SketchUp)
    if ((window as any).sketchup?.abrir_gem) {
      try {
        (window as any).sketchup.abrir_gem(popoutUrl);
        showToast('✓ Janela de Materiais e Objetos aberta dentro do SketchUp!');
        return;
      } catch (err) {
        console.warn('Falha em abrir_gem fallback:', err);
      }
    }

    // 3. Fallback comando de cena:
    if ((window as any).sketchup?.executar_comando_cena) {
      try {
        (window as any).sketchup.executar_comando_cena('abrir_dialogo_materiais', JSON.stringify({ url: popoutUrl }));
      } catch (_) {}
    }

    // 4. Se for navegador web ou se a janela popout do navegador estiver disponível:
    if (typeof window !== 'undefined') {
      try {
        const popWin = window.open(
          popoutUrl,
          'SKPMateriaisObjetos',
          'width=1100,height=760,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no'
        );
        if (popWin && !popWin.closed) {
          popWin.focus();
          showToast('✓ Janela de Materiais e Objetos aberta!');
          return;
        }
      } catch (_) {}
    }

    // 5. Fallback: Modal amplo dentro do viewport
    setShowMaterialsModal(true);
  };

  const handleOpenMaterialsExternalWindow = (customImg?: string) => {
    const imgToUse = customImg || attachedImage || messages.slice().reverse().find((m) => Boolean(m.image))?.image || null;
    syncMaterialsBroadcast(detectedMaterials, imgToUse);

    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    const popoutUrl = `${currentOrigin}${currentPath}?popout=materials${skpPcId ? `&skp_pcid=${encodeURIComponent(skpPcId)}` : ''}`;

    // Se estiver rodando dentro do SketchUp, aciona o método nativo Ruby para abrir no navegador do sistema:
    if ((window as any).sketchup?.abrir_url_externa) {
      try {
        (window as any).sketchup.abrir_url_externa(popoutUrl);
      } catch (_) {}
    }

    // Janela externa desvinculada Pop-out no navegador (ou janela separada)
    try {
      const popWin = window.open(
        popoutUrl,
        'SKPMateriaisObjetos',
        'width=1240,height=840,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no'
      );
      if (popWin) {
        popWin.focus();
      }
    } catch (_) {}

    showToast('✓ Janela de Materiais e Objetos aberta fora do plugin!');
  };

  const handleUpdateMaterial = (id: string, element: string, description: string) => {
    const updated = detectedMaterials.map((m) =>
      m.id === id ? { ...m, element, description } : m
    );
    setDetectedMaterials(updated);
    updateInputWithMaterials(updated);
    syncMaterialsBroadcast(updated);
    showToast(`✓ Material "${element}" atualizado!`);
  };

  const handleDeleteMaterial = (id: string) => {
    const updated = detectedMaterials.filter((m) => m.id !== id);
    setDetectedMaterials(updated);
    updateInputWithMaterials(updated);
    syncMaterialsBroadcast(updated);
    showToast('✓ Material removido!');
  };

  const handleAddMaterial = (element: string, description: string, category?: string) => {
    const newMat: DetectedMaterial = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      element,
      description,
      category: category || 'Objetos & Decoração',
    };
    const updated = [...detectedMaterials, newMat];
    setDetectedMaterials(updated);
    updateInputWithMaterials(updated);
    syncMaterialsBroadcast(updated);
    showToast(`✓ Material "${element}" adicionado!`);
  };

  const handleClearMaterials = () => {
    setDetectedMaterials([]);
    updateInputWithMaterials([]);
    syncMaterialsBroadcast([]);
    showToast('✓ Lista de materiais limpa.');
  };

  // Identificar materiais do print com IA e escrever na caixa de mensagem
  const handleDetectMaterials = async (targetImg?: string) => {
    // REGRA DE OURO: O print em espera para ser enviado (attachedImage) é SEMPRE prioridade máxima absoluta!
    let imgToAnalyze = attachedImage || targetImg;
    if (!imgToAnalyze) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].image) {
          imgToAnalyze = messages[i].image;
          break;
        }
      }
    }

    if (!imgToAnalyze) {
      showToast('📸 Tire um print (botão SKP) ou anexe uma imagem (+ IMG) para detectar os materiais!');
      return;
    }

    setIsDetectingMaterials(true);
    showToast('🔍 IA realizando leitura profunda de materiais e objetos do print em espera...');

    try {
      const res = await fetch('/api/detect-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imgToAnalyze,
          currentText: input,
          language: language
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.materials)) {
        setDetectedMaterials(data.materials);
        updateInputWithMaterials(data.materials);
        syncMaterialsBroadcast(data.materials, imgToAnalyze);
        showToast(`✓ ${data.materials.length} materiais e objetos identificados no print atual!`);
      } else {
        throw new Error(data.error || 'Falha ao identificar materiais e objetos');
      }
    } catch (err: any) {
      console.error('[DETECT MATERIALS ERROR]', err);
      showToast('⚠️ Erro ao ler materiais do print: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsDetectingMaterials(false);
    }
  };

  // Send message to Gemini server endpoint
  const sendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    let currentImg = attachedImage;

    if ((!messageContent && !currentImg) || isLoading) return;

    // Compress image before adding to state or sending to prevent CEF memory overflow in SketchUp
    if (currentImg && (currentImg.length > 400000 || !currentImg.startsWith('data:image/jpeg'))) {
      try {
        currentImg = await optimizeDataUrl(currentImg, 4096, 0.85);
      } catch (_) {}
    }

    const isImported = attachedImageMeta?.isImported || false;
    const imgWidth = isImported ? attachedImageMeta!.naturalWidth : width;
    const imgHeight = isImported ? attachedImageMeta!.naturalHeight : height;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageContent || (currentImg ? (isImported ? 'Renderize esta imagem com materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista.' : 'Transforme este print 3D do SketchUp em uma fotografia arquitetônica real, mantendo rigorosamente a posição da câmera, o layout e as texturas base, ajustando somente materiais PBR, iluminação global e atmosfera fotográfica.') : ''),
      image: currentImg || undefined,
      isImported,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    removeAttachedImage();
    setIsLoading(true);
    scrollToBottom('smooth');

    try {
      const currentConfig: RenderConfig = {
        ratio: isImported ? (imgWidth / imgHeight) : ratio,
        width: imgWidth,
        height: imgHeight,
        isImported,
      };

      // Sanitize payload to send only recent messages and prevent 413 payload overflow
      const payloadMessages = newMessages.slice(-6).map((m, idx, arr) => {
        // Keep the image on the very last image message, truncate older image payloads to save bandwidth
        const isLastOrNearLast = idx >= arr.length - 2;
        return {
          id: m.id,
          sender: m.sender,
          text: m.text,
          image: isLastOrNearLast ? m.image : undefined,
          isImported: m.isImported,
          imageWidth: m.imageWidth,
          imageHeight: m.imageHeight,
        };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          currentConfig,
          language,
          lightingReport
        }),
      });

      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (!response.ok) {
        if (response.status === 413) {
          data = {
            reply: '⚠️ A imagem enviada foi muito pesada para a rede. Ela foi otimizada automaticamente — por favor, tente enviar novamente.',
          };
        } else {
          data = {
            reply: 'Não foi possível completar o processamento no momento. Por favor, tente enviar novamente.',
          };
        }
      } else {
        const textContent = await response.text();
        console.warn('Non-JSON response received:', textContent);
        data = { reply: 'Resposta recebida do servidor.' };
      }

      const iaReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: data.reply || 'Comando processado com sucesso pelo SKP Render Pro IA.',
        image: data.image || undefined,
        masterPrompt: data.masterPrompt || undefined,
        imageWidth: data.imageWidth || imgWidth,
        imageHeight: data.imageHeight || imgHeight,
        isImported,
      };

      setMessages((prev) => [...prev, iaReply]);
      scrollToBottom('smooth');
      setTimeout(() => scrollToBottom('auto'), 150);

      // Save current image to reference if we get a master prompt back
      const imageToGallery = data.image || currentImg;

      if (data.masterPrompt && imageToGallery) {
        window.dispatchEvent(new CustomEvent('add-to-skp-gallery', {
          detail: { image: imageToGallery, prompt: data.masterPrompt }
        }));
      }

      if (data.masterPrompt) {
        handleCopyText(data.masterPrompt, `mp-${iaReply.id}`);
        showToast('✓ Super Prompt gerado com IA e copiado!');
      }
    } catch (err) {
      console.error('Error communicating with IA:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: 'Não foi possível conectar ao servidor no momento. Por favor, tente novamente.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Edit message handlers
  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text || '');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveAndRegenerate = async (msgId: string, customText?: string) => {
    const textToUse = customText !== undefined ? customText.trim() : editingText.trim();
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    if (!textToUse && !targetMsg.image) return;

    let msgImg = targetMsg.image;
    if (msgImg && (msgImg.length > 400000 || !msgImg.startsWith('data:image/jpeg'))) {
      try {
        msgImg = await optimizeDataUrl(msgImg, 4096, 0.85);
      } catch (_) {}
    }

    const isImported = targetMsg.isImported || false;
    const imgWidth = targetMsg.imageWidth || width;
    const imgHeight = targetMsg.imageHeight || height;

    const updatedUserMsg: Message = {
      ...targetMsg,
      text: textToUse || targetMsg.text || 'Aplique as alterações e refaça a fotografia arquitetônica ultra realista.',
      image: msgImg,
      isImported,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
    };

    // Replace user message and remove subsequent messages from this point so AI generates a clean new response
    const newMessages = [...messages.slice(0, msgIndex), updatedUserMsg];
    setMessages(newMessages);
    setEditingMessageId(null);
    setEditingText('');
    setIsLoading(true);
    scrollToBottom('smooth');

    try {
      const currentConfig: RenderConfig = {
        ratio: isImported ? (imgWidth / imgHeight) : ratio,
        width: imgWidth,
        height: imgHeight,
        isImported,
      };

      const payloadMessages = newMessages.slice(-6).map((m, idx, arr) => {
        const isLastOrNearLast = idx >= arr.length - 2;
        return {
          id: m.id,
          sender: m.sender,
          text: m.text,
          image: isLastOrNearLast ? m.image : undefined,
          isImported: m.isImported,
          imageWidth: m.imageWidth,
          imageHeight: m.imageHeight,
        };
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          currentConfig,
          language,
          lightingReport
        }),
      });

      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { reply: 'Resposta recebida do servidor.' };
      }

      const iaReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ia',
        text: data.reply || 'Comando corrigido e processado com sucesso pelo SKP Render Pro IA.',
        image: data.image || undefined,
        masterPrompt: data.masterPrompt || undefined,
        imageWidth: data.imageWidth || imgWidth,
        imageHeight: data.imageHeight || imgHeight,
        isImported,
      };

      setMessages((prev) => [...prev, iaReply]);
      scrollToBottom('smooth');
      setTimeout(() => scrollToBottom('auto'), 150);

      const imageToGallery = data.image || updatedUserMsg.image;
      if (data.masterPrompt && imageToGallery) {
        window.dispatchEvent(
          new CustomEvent('add-to-skp-gallery', {
            detail: { image: imageToGallery, prompt: data.masterPrompt },
          })
        );
      }

      if (data.masterPrompt) {
        handleCopyText(data.masterPrompt, `mp-${iaReply.id}`);
      }
      showToast('✓ Imagem refeita pela IA com suas correções!');
    } catch (err) {
      console.error('Error regenerating with edited prompt:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ia',
          text: 'Não foi possível refazer a imagem no momento. Por favor, tente novamente.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter / Shift+Enter in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Open Gemini Gem IA (via SketchUp Dialog se estiver dentro do SketchUp, ou nova aba)
  const handleOpenGem = () => {
    const gemUrl = 'https://gemini.google.com/gem/1G2t4Otxm7RqE88jeaVMh3862abPxfqdh?usp=sharing';
    if ((window as any).sketchup?.abrir_gem) {
      (window as any).sketchup.abrir_gem(gemUrl);
      showToast('🤖 Abrindo Gemini Gem IA...');
    } else {
      window.open(gemUrl, '_blank');
      showToast('🤖 Abrindo Gemini Gem IA...');
    }
  };

  // Open SKP IA 01 (via SketchUp Dialog se estiver dentro do SketchUp, ou nova aba)
  const handleOpenBase44 = () => {
    const appUrl = 'https://skp-render-pro-7f071a69.base44.app/login';
    try {
      if ((window as any).sketchup?.abrir_skp_ia1) {
        (window as any).sketchup.abrir_skp_ia1(appUrl);
        showToast('🚀 Abrindo SKP IA 01 no SketchUp...');
      } else if ((window as any).sketchup?.abrir_gem) {
        (window as any).sketchup.abrir_gem(appUrl);
        showToast('🚀 Abrindo SKP IA 01 no SketchUp...');
      } else {
        window.open(appUrl, '_blank');
        showToast('🚀 Abrindo SKP IA 01...');
      }
    } catch (_) {
      window.open(appUrl, '_blank');
    }
  };

  // Open SKP IA 02 (via SketchUp Dialog se estiver dentro do SketchUp, ou nova aba)
  const handleOpenSkpIa02 = () => {
    const appUrl = 'https://read-txt-app-1.preview.emergentagent.com/login';
    try {
      if ((window as any).sketchup?.abrir_skp_ia2) {
        (window as any).sketchup.abrir_skp_ia2(appUrl);
        showToast('🚀 Abrindo SKP IA 02 no SketchUp...');
      } else if ((window as any).sketchup?.abrir_gem) {
        (window as any).sketchup.abrir_gem(appUrl);
        showToast('🚀 Abrindo SKP IA 02 no SketchUp...');
      } else {
        window.open(appUrl, '_blank');
        showToast('🚀 Abrindo SKP IA 02...');
      }
    } catch (_) {
      window.open(appUrl, '_blank');
    }
  };

  // Social link handlers
  const handleSocialLink = (platform: 'insta' | 'zap') => {
    if (platform === 'insta') {
      window.open('https://www.instagram.com/skp.renderpro?stkn=MzR2cG13bG8xNDU0', '_blank');
    } else {
      window.open('https://wa.me/message/M5CMAWWCISEQP1', '_blank');
    }
  };

  // Action button: ENVIAR
  const handleRender = () => {
    if (input.trim() || attachedImage) {
      sendMessage();
    } else {
      setShowOverlayModal(true);
    }
  };

  // Action button: SALVAR / EXPORTAR
  const handleSave = async () => {
    // Se houver print ativo ou recente, salva diretamente no computador com a resolução rigorosa
    let imageToSave = attachedImage;
    let isImported = attachedImageMeta?.isImported || false;
    let imgW = attachedImageMeta?.naturalWidth || width;
    let imgH = attachedImageMeta?.naturalHeight || height;

    if (!imageToSave) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].image) {
          imageToSave = messages[i].image;
          isImported = messages[i].isImported || false;
          imgW = messages[i].imageWidth || width;
          imgH = messages[i].imageHeight || height;
          break;
        }
      }
    }

    if (imageToSave) {
      if (isImported) {
        await downloadImageWithExactResolution(imageToSave, -1, -1, 'Imagem_Importada');
      } else {
        await downloadImageWithExactResolution(imageToSave, imgW, imgH, 'SKP_Print');
      }
    }

    if (isImported) {
      const confirmationMsg: Message = {
        id: Date.now().toString(),
        sender: 'ia',
        text: `✓ Imagem salva com sua dimensão real de ${imgW}x${imgH}px (preservando o arquivo original sem alteração de proporção)!`,
      };
      setMessages((prev) => [...prev, confirmationMsg]);
      return;
    }

    const ratioLabel = ratio === 0.8 ? '4:5 (Insta)' : ratio === 0.5625 ? '9:16 (Stories)' : ratio === 1 ? '1:1 (Square)' : ratio === 1.777 ? '16:9 (Wide)' : `${width}:${height}`;
    const configSummary = `SKP RENDER PRO IA - CONFIGURAÇÕES:\nProporção: ${ratio} (${ratioLabel})\nResolução: ${width} x ${height} px\n`;
    
    // Safer copy to clipboard using our universal helper
    await handleCopyText(configSummary);

    const confirmationMsg: Message = {
      id: Date.now().toString(),
      sender: 'ia',
      text: `📋 Dados de Render e Print salvos com exatos ${width}x${height}px!\n\n• Resolução: ${width}x${height}px\n• Proporção: ${ratioLabel}${imageToSave ? '\n• Arquivo do print salvo no seu computador!' : ''}`,
    };
    setMessages((prev) => [...prev, confirmationMsg]);
  };

  // Sync camera visualizer with SketchUp Viewport
  const sync = (newRatio = ratio, newW = width, newH = height, isSafe = safeFrame) => {
    // CRÍTICO: Janelas secundárias (como a tela de leitura de materiais ou panorama 360) NUNCA podem alterar a moldura do SketchUp!
    if (isPopoutMaterialsMode || isPopoutPanorama360Mode) return;

    try {
      if (!isSafe && (window as any).sketchup?.desativar_moldura) {
        (window as any).sketchup.desativar_moldura();
        return;
      }
      if ((window as any).sketchup?.sync_overlay) {
        (window as any).sketchup.sync_overlay(
          Number(newRatio), 
          Number(newW), 
          Number(newH), 
          Boolean(isSafe), 
          false
        );
      }
    } catch (err) {
      console.warn('Erro ao sincronizar overlay:', err);
    }
  };

  // Capture screen from SketchUp Viewport directly or fallback to screen capture API
  const is360Mode = Math.abs(ratio - 2.0) < 0.02;

  const handleCaptureSketchUp = async (
    overrideW?: number,
    overrideH?: number,
    overrideRatio?: number,
    is360ModeTrigger?: boolean
  ) => {
    const targetW = overrideW && overrideW > 0 ? overrideW : (width > 0 ? width : 2000);
    const targetH = overrideH && overrideH > 0 ? overrideH : (height > 0 ? height : Math.round(targetW / (overrideRatio || ratio || 0.8)));
    const targetRatio = overrideRatio && overrideRatio > 0 ? overrideRatio : (targetW / targetH);
    const is360 = is360ModeTrigger || Math.abs(targetRatio - 2.0) < 0.05;

    // 1. Se estiver rodando dentro do SketchUp
    if ((window as any).sketchup?.capturar_viewport) {
      try {
        if (is360) {
          setIsCapturing360(true);
          showToast(`🌐 Capturando print 360° Panorâmico no SketchUp (${targetW}x${targetH}px - 2:1 VR)...`);
        } else {
          setIsCapturing(true);
          showToast(`📸 Capturando cena do SketchUp em ${targetW}x${targetH}px...`);
        }
        (window as any).sketchup.capturar_viewport(Number(targetW), Number(targetH));
        setTimeout(() => {
          setIsCapturing(false);
          setIsCapturing360(false);
        }, 2500);
        return;
      } catch (err) {
        console.error('Erro ao chamar capturar_viewport:', err);
        setIsCapturing(false);
        setIsCapturing360(false);
      }
    }

    // 2. Se estiver no navegador web, permite capturar a tela/janela do SketchUp e corta na moldura
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      try {
        if (is360) {
          setIsCapturing360(true);
          showToast('🌐 Selecione a janela do SketchUp para capturar em 360° Panorâmico...');
        } else {
          setIsCapturing(true);
          showToast('📸 Selecione a janela do SketchUp para capturar...');
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window',
          } as any,
          audio: false,
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // Aguarda estabilização do frame
        await new Promise((resolve) => setTimeout(resolve, 350));

        const srcW = video.videoWidth || 1920;
        const srcH = video.videoHeight || 1080;

        // Calcula a área central da moldura (Safe Frame) com base na proporção Largura x Altura
        const srcRatio = srcW / srcH;
        let cropW = srcW;
        let cropH = srcH;
        let cropX = 0;
        let cropY = 0;

        if (srcRatio > targetRatio) {
          cropH = srcH;
          cropW = srcH * targetRatio;
          cropX = (srcW - cropW) / 2;
          cropY = 0;
        } else {
          cropW = srcW;
          cropH = srcW / targetRatio;
          cropX = 0;
          cropY = (srcH - cropH) / 2;
        }

        let finalW = targetW;
        let finalH = targetH;
        const maxResolution = 8000;
        if (finalW > maxResolution || finalH > maxResolution) {
          if (finalW > finalH) {
            finalH = Math.round((finalH * maxResolution) / finalW);
            finalW = maxResolution;
          } else {
            finalW = Math.round((finalW * maxResolution) / finalH);
            finalH = maxResolution;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(finalW);
        canvas.height = Math.round(finalH);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível obter contexto do Canvas 2D');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
          video,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          canvas.width,
          canvas.height
        );

        stream.getTracks().forEach((track) => track.stop());

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setAttachedImage(dataUrl);
        setAttachedImageName(is360 ? `Print_SketchUp_360_${canvas.width}x${canvas.height}.jpg` : `Print_${canvas.width}x${canvas.height}.jpg`);
        setAttachedImageMeta(null);
        setDetectedMaterials([]);
        updateInputWithMaterials([]);
        syncMaterialsBroadcast([], dataUrl);
        showToast(is360 ? `✓ Print 360° capturado na moldura (${canvas.width}x${canvas.height}px - 2:1 VR)!` : `✓ Tela cortada na moldura (${canvas.width}x${canvas.height}px)!`);
        return;
      } catch (err) {
        console.warn('Captura cancelada:', err);
      } finally {
        setIsCapturing(false);
        setIsCapturing360(false);
      }
    }

    // 3. Fallback: abre seletor de arquivos de print
    fileInputRef.current?.click();
    showToast('Selecione o arquivo de print do SketchUp');
  };

  // Abertura do fluxo de geração de Panorama 360° com IA
  const handleCapture360 = () => {
    setShowPanorama360Modal(true);
  };

  // Recebe o panorama equirretangular gerado e anexa ao prompt
  const handleUsePanorama360 = (imageDataUrl: string, resolution: { width: number; height: number }) => {
    setAttachedImage(imageDataUrl);
    setAttachedImageName('Print_SketchUp_360_Equirretangular.jpg');
    setAttachedImageMeta({
      naturalWidth: resolution.width,
      naturalHeight: resolution.height,
      isImported: true
    });

    const fmt360 = OUTPUT_FORMATS.find(f => f.id === '360') || {
      id: '360',
      label: '360° VR',
      sublabel: '2:1',
      ratio: 2.0,
      defaultWidth: 8000,
      defaultHeight: 4000
    };

    setRatio(fmt360.ratio);
    setWidth(fmt360.defaultWidth);
    setHeight(fmt360.defaultHeight);
    sync(fmt360.ratio, fmt360.defaultWidth, fmt360.defaultHeight, safeFrame);

    if (!input.trim()) {
      setInput('A1 GERAR - Fotografia arquitetônica profissional editorial de interiores, mantendo rigorosamente a geometria, enquadramento e perspectiva do modelo 3D, com materiais PBR de altíssima definição, iluminação global realista e fidelidade absoluta à arquitetura.');
    }

    showToast('✓ Panorama 360° Equirretangular (8000x4000 8K) anexado ao prompt!');
  };

  // Sync on mount - ativação automática da moldura ao abrir (APENAS na janela principal do plugin)
  useEffect(() => {
    if (isPopoutMaterialsMode || isPopoutPanorama360Mode) return;
    sync(ratio, width, height, safeFrame);
  }, [ratio, width, height, safeFrame, isPopoutMaterialsMode, isPopoutPanorama360Mode]);

  // Garante que a moldura seja desativada no SketchUp SOMENTE se a janela principal do plugin for fechada
  useEffect(() => {
    if (isPopoutMaterialsMode || isPopoutPanorama360Mode) return;

    const handleCloseOrUnload = () => {
      try {
        if ((window as any).sketchup?.desativar_moldura) {
          (window as any).sketchup.desativar_moldura();
        } else if ((window as any).sketchup?.sync_overlay) {
          (window as any).sketchup.sync_overlay(0.8, 2000, 2500, false, false);
        }
      } catch (_) {}
    };

    window.addEventListener('beforeunload', handleCloseOrUnload);
    window.addEventListener('unload', handleCloseOrUnload);

    return () => {
      window.removeEventListener('beforeunload', handleCloseOrUnload);
      window.removeEventListener('unload', handleCloseOrUnload);
    };
  }, [isPopoutMaterialsMode, isPopoutPanorama360Mode]);

  // Listener for images captured directly from SketchUp Ruby Plugin
  useEffect(() => {
    const handleSkpImage = async (event: any) => {
      if (event?.detail?.dataUrl) {
        let finalDataUrl = event.detail.dataUrl;
        const targetW = event?.detail?.width || width;
        const targetH = event?.detail?.height || height;
        const targetR = event?.detail?.ratio || ratio;
        const lights = event?.detail?.lighting_report || '';
        setLightingReport(lights);

        const is360 = Math.abs(targetR - 2.0) < 0.05 || (targetW && targetH && Math.abs(targetW / targetH - 2.0) < 0.05);
        try {
          const rawUrl = event.detail.dataUrl;
          // Garante corte rigoroso na moldura e proporção
          const cropped = await cropDataUrlToRatio(rawUrl, targetW, targetH, targetR);
          finalDataUrl = await optimizeDataUrl(cropped, is360 ? 8000 : 4096, 0.92);
        } catch (_) {}

        const printName = is360 
          ? `Print_SketchUp_360_${targetW}x${targetH}.jpg`
          : `Print_SketchUp_${targetW}x${targetH}.jpg`;

        setAttachedImage(finalDataUrl);
        setAttachedImageName(printName);
        setAttachedImageMeta(null);

        // Limpa materiais anteriores para ler os do novo print atual em espera
        setDetectedMaterials([]);
        updateInputWithMaterials([]);
        syncMaterialsBroadcast([], finalDataUrl);

        if (is360) {
          showToast(`✓ Print 360° Panorâmico capturado (${targetW}x${targetH}px - 2:1 VR)!`);
        } else {
          showToast(`✓ Novo print capturado na moldura (${targetW}x${targetH}px)!`);
        }
      }
    };
    window.addEventListener('skp-image-captured', handleSkpImage);
    return () => {
      window.removeEventListener('skp-image-captured', handleSkpImage);
    };
  }, [width, height, ratio]);

  useEffect(() => {
    // Se estiver no SketchUp, solicita os dados do PC (pode ser usado para outras coisas no futuro)
    if ((window as any).sketchup?.pedir_info_licenca) {
      (window as any).sketchup.pedir_info_licenca();
    }
  }, []);

  // Listener para sincronização com a Janela Dedicada 360 do SketchUp
  useEffect(() => {
    const handlePopoutUse360 = (event: any) => {
      const dataUrl = event?.detail?.dataUrl;
      const res = event?.detail?.resolution || { width: 8000, height: 4000 };
      if (dataUrl) {
        handleUsePanorama360(dataUrl, res);
        showToast('✓ Panorama 360° recebido da janela dedicada e anexado ao prompt!');
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('skp_panorama360_channel');
        bc.onmessage = (ev) => {
          if (ev.data?.action === 'use_panorama' && ev.data.dataUrl) {
            handleUsePanorama360(ev.data.dataUrl, ev.data.resolution || { width: 8000, height: 4000 });
            showToast('✓ Panorama 360° recebido da janela dedicada e anexado ao prompt!');
          }
        };
      }
    } catch (_) {}

    window.addEventListener('skp-360-usar-panorama', handlePopoutUse360);

    const handleMirrorCreated = (e: any) => {
      const matName = e?.detail?.name || 'Espelho Real';
      showToast(`✓ ${matName}: Reflexão física aplicada na geometria do SketchUp!`);
    };
    window.addEventListener('skp-mirror-created', handleMirrorCreated);

    return () => {
      window.removeEventListener('skp-360-usar-panorama', handlePopoutUse360);
      window.removeEventListener('skp-mirror-created', handleMirrorCreated);
      if (bc) bc.close();
    };
  }, []);

  if (skpPcId && licenseBlocked) {
    return (
      <SketchUpActivationLock
        pcId={skpPcId}
        errorMessage={licenseBlockedReason}
        onActivated={(name) => {
          setLicenseBlocked(false);
          showToast(`✓ Licença ativada com sucesso! Bem-vindo, ${name || 'Usuário'}.`);
        }}
        onRecheck={verifySketchupStatus}
        onDownloadRb={() => handleDownloadRb()}
      />
    );
  }

  // Se a página foi aberta como Pop-out da Prévia 360° (Janela Separada do SketchUp)
  if (isPopoutPanorama360Mode) {
    return (
      <Panorama360PopoutView
        onUsePanorama={(imgUrl, res) => {
          handleUsePanorama360(imgUrl, res);
        }}
        showToast={showToast}
      />
    );
  }

  // Se a página foi aberta como Pop-out fora do plugin
  if (isPopoutMaterialsMode) {
    const activeImage = attachedImage || (messages.length ? messages.slice().reverse().find((m) => Boolean(m.image))?.image : null);
    return (
      <MaterialsEditorModal
        materials={detectedMaterials}
        image={activeImage}
        imageName={attachedImage ? (attachedImageName || 'Print em Espera para Envio') : (attachedImageName || 'Cena 3D SketchUp (Janela Externa)')}
        onUpdateMaterial={handleUpdateMaterial}
        onDeleteMaterial={handleDeleteMaterial}
        onAddMaterial={handleAddMaterial}
        onClearMaterials={handleClearMaterials}
        isDetecting={isDetectingMaterials}
        onDetectMaterials={() => handleDetectMaterials(attachedImage || undefined)}
        onClose={() => {
          try {
            if ((window as any).sketchup?.fechar_dialogo_materiais) {
              (window as any).sketchup.fechar_dialogo_materiais();
            }
          } catch (_) {}
          try {
            window.close();
          } catch (_) {}
        }}
        isPopoutWindow={true}
      />
    );
  }

  // Escala dinâmica do painel de configuração:
    // configHeight varia de 55px (ultra-compacto com tudo ajustado e visível) até 220px (amplo)
    // configT = 0 em 55px, 1 em 105px ou mais
    const configT = Math.max(0, Math.min(1, (configHeight - 55) / (105 - 55)));
    const configStyles = {
      panelPy: Math.round(1 + configT * 7), // 1px a 8px
      panelPx: Math.round(2 + configT * 10), // 2px a 12px
      labelSize: (7.2 + configT * 2.8).toFixed(1) + 'px', // 7.2px a 10px
      labelMb: Math.round(0 + configT * 4), // 0px a 4px
      inputH: Math.round(18 + configT * 12), // 18px a 30px
      inputFont: (8.2 + configT * 2.8).toFixed(1) + 'px', // 8.2px a 11px
      inputPy: Math.round(1 + configT * 5), // 1px a 6px
      inputPx: Math.round(2 + configT * 6), // 2px a 8px
      togglePy: Math.round(0 + configT * 6), // 0px a 6px
      togglePx: Math.round(2 + configT * 8), // 2px a 10px
      toggleMt: Math.round(0 + configT * 5), // 0px a 5px
      gap: Math.max(2, Math.round(configT * 6)), // 0px a 6px
      btnPy: Math.round(1 + configT * 3), // 1px a 4px
      btnPx: Math.round(2 + configT * 6), // 2px a 8px
      btnFont: (7.5 + configT * 3.5).toFixed(1) + 'px', // 7.5px a 11px
      iconSize: Math.round(9 + configT * 5), // 9px a 14px
      socialSize: Math.round(14 + configT * 12), // 14px a 26px
      chkSize: Math.round(10 + configT * 4), // 10px a 14px
      chkFont: (7.5 + configT * 3.5).toFixed(1) + 'px', // 7.5px a 11px
    };

    return (
    <div className={`flex flex-col h-screen w-full mx-auto bg-[#f4f7f6] shadow-xl overflow-hidden selection:bg-emerald-100 ${isResizingHeader || isResizingFooter || isResizingConfig ? 'select-none cursor-row-resize' : ''}`}>
      {/* HEADER */}
      <div 
        className="header shrink-0 flex items-center justify-between relative px-2 overflow-hidden bg-[#faf8f5] border-b border-stone-200 shadow-xs"
        style={{ height: `${headerHeight}px` }}
      >
        {/* Lado Esquerdo: Área livre */}
        <div className="w-[40px] h-full" />

        {/* Logo Area - Globalmente Centralizada (Abaixo dos botões laterais no Z-index) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20 sm:px-24">
          <div className="relative group flex items-center justify-center">
            <img 
              src={customHeaderLogo || "/skp_header_banner.png"} 
              alt="SKP RENDER PRO" 
              style={{ 
                height: `${Math.max(16, headerHeight - 8)}px`,
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              className="transition-all duration-150 select-none pointer-events-auto cursor-pointer"
              referrerPolicy="no-referrer"
              onDoubleClick={() => headerLogoInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const res = ev.target?.result as string;
                    if (res) {
                      setCustomHeaderLogo(res);
                      try { localStorage.setItem('skp_ui_custom_logo', res); } catch (_) {}
                      showToast('✓ Imagem do cabeçalho atualizada!');
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            
            {customHeaderLogo && (
              <button
                type="button"
                onClick={handleResetHeaderLogo}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 bg-stone-900/80 hover:bg-stone-900 text-white text-[8px] px-1.5 py-0.5 rounded transition shadow-sm z-30 cursor-pointer pointer-events-auto"
                title="Restaurar banner padrão"
              >
                Restaurar Padrão
              </button>
            )}
          </div>
        </div>

        {/* Lado Direito: Social / Admin / Spacer */}
        <div className="relative z-50 flex items-center h-full gap-3 justify-end pr-3">
          {/* Botão de Administração - Visível ESTRITAMENTE fora do SketchUp (no navegador web) */}
          {!isInsideSketchup && (
            <button
              id="header-btn-admin"
              type="button"
              onClick={handleOpenAdminPanel}
              className="flex items-center gap-1.5 px-2 py-1 text-[9px] sm:text-[10px] font-semibold text-stone-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 active:scale-95 border border-stone-300 hover:border-emerald-300 rounded shadow-xs transition-all cursor-pointer whitespace-nowrap"
              title="Painel de Administração de Licenças"
            >
              <Key className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-600 shrink-0" />
              <span className="tracking-wide">Admin</span>
            </button>
          )}

          {/* Redes Sociais no Header - Agora na extremidade direita conforme marcado na foto */}
          <div className="flex items-center gap-2.5">
            <InstagramIcon 
              className="w-5.5 h-5.5 text-stone-600 hover:text-[#E4405F] transition-all cursor-pointer active:scale-90 hover:scale-110" 
              onClick={() => handleSocialLink('insta')} 
            />
            <WhatsAppIcon 
              className="w-5.5 h-5.5 text-stone-600 hover:text-[#25D366] transition-all cursor-pointer active:scale-90 hover:scale-110" 
              onClick={() => handleSocialLink('zap')} 
            />
          </div>
        </div>

        {/* Header Resizer Handle */}
        <div 
          onMouseDown={startResizingHeader}
          className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-emerald-500/40 transition-colors z-20 group"
        >
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 px-3 py-0 bg-white border border-stone-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
             <div className="w-6 h-0.5 bg-stone-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* Input oculto para upload de logotipo/banner personalizado */}
      <input 
        type="file" 
        ref={headerLogoInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleHeaderLogoUpload} 
      />

      {/* MAIN BODY: NORMAL PLUGIN INTERFACE */}
      <>
        {/* CONFIG PANEL - TOTALMENTE AJUSTÁVEL COM ESCALA DINÂMICA DE TODOS OS ITENS */}
        <div 
          className="config-panel shrink-0 relative flex flex-col justify-center bg-white border-b border-stone-200"
          style={{ 
            height: `${configHeight}px`,
            padding: `${configStyles.panelPy}px ${configStyles.panelPx}px`,
            boxSizing: 'border-box'
          }}
        >
          {/* Linha 1: PROPORÇÃO, LARGURA, ALTURA */}
          <div className="flex items-center w-full shrink-0" style={{ gap: `${configStyles.gap}px` }}>
            {/* PROPORÇÃO */}
            <div className="config-group flex-1 min-w-[70px]">
              <label 
                htmlFor="ratio"
                style={{ fontSize: configStyles.labelSize, marginBottom: `${configStyles.labelMb}px` }}
              >
                {t.proportion}
              </label>
              <select 
                id="ratio" 
                value={
                  OUTPUT_FORMATS.find(f => Math.abs(f.ratio - ratio) < 0.02)?.ratio || ratio
                } 
                onChange={handleRatioChange}
                className="w-full font-medium"
                style={{ 
                  height: `${configStyles.inputH}px`, 
                  fontSize: configStyles.inputFont, 
                  padding: `${configStyles.inputPy}px ${configStyles.inputPx}px` 
                }}
              >
                {OUTPUT_FORMATS.map((fmt) => (
                  <option key={fmt.id} value={fmt.ratio}>
                    {fmt.label} ({fmt.sublabel})
                  </option>
                ))}
                {!OUTPUT_FORMATS.some(f => Math.abs(f.ratio - ratio) < 0.02) && (
                  <option value={ratio}>Personalizado ({width}:{height})</option>
                )}
              </select>
            </div>

            {/* LARGURA */}
            <div className="config-group flex-1 min-w-[30px]">
              <label 
                htmlFor="w"
                style={{ fontSize: configStyles.labelSize, marginBottom: `${configStyles.labelMb}px` }}
              >
                {t.width}
              </label>
              <input 
                type="number" 
                id="w" 
                value={width} 
                onChange={handleWidthChange}
                min={100}
                max={8000}
                step={10}
                title="Largura da imagem em pixels"
                style={{ 
                  height: `${configStyles.inputH}px`, 
                  fontSize: configStyles.inputFont, 
                  padding: `${configStyles.inputPy}px ${configStyles.inputPx}px` 
                }}
              />
            </div>

            {/* ALTURA */}
            <div className="config-group flex-1 min-w-[30px]">
              <label 
                htmlFor="h"
                style={{ fontSize: configStyles.labelSize, marginBottom: `${configStyles.labelMb}px` }}
              >
                {t.height}
              </label>
              <input 
                type="number" 
                id="h" 
                value={height} 
                onChange={handleHeightChange}
                min={100}
                max={8000}
                step={10}
                title="Altura da imagem em pixels (você pode digitar um valor personalizado)"
                style={{ 
                  height: `${configStyles.inputH}px`, 
                  fontSize: configStyles.inputFont, 
                  padding: `${configStyles.inputPy}px ${configStyles.inputPx}px` 
                }}
              />
            </div>

            {/* ATIVAR MOLDURA (SAFE FRAME) NA MESMA LINHA */}
            <div className="config-group shrink-0 flex flex-col justify-end">
              <label 
                htmlFor="btnToggleMoldura"
                style={{ fontSize: configStyles.labelSize, marginBottom: `${configStyles.labelMb}px` }}
                className="whitespace-nowrap cursor-pointer text-center font-bold"
              >
                {t.frame}
              </label>
              <button
                type="button"
                id="btnToggleMoldura"
                onClick={() => {
                  const next = !safeFrame;
                  setSafeFrame(next);
                  sync(ratio, width, height, next);
                  showToast(next ? '✓ Moldura ativada no SketchUp' : 'Moldura desativada');
                }}
                className={`flex items-center justify-center font-bold rounded transition-all cursor-pointer shadow-xs border select-none active:scale-95 ${
                  safeFrame
                    ? 'bg-[#1e4233] text-[#4ade80] border-[#4ade80]/60 hover:bg-[#153426]'
                    : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                }`}
                style={{ 
                  height: `${configStyles.inputH}px`, 
                  fontSize: configStyles.inputFont, 
                  padding: `0 ${configStyles.inputPx + 4}px`,
                  gap: '4px'
                }}
                title="Ativar ou desativar a moldura (Safe Frame) no SketchUp"
              >
                <input
                  type="checkbox"
                  checked={safeFrame}
                  onChange={() => {}}
                  className="pointer-events-none cursor-pointer"
                  style={{ width: `${Math.max(8, configStyles.chkSize - 1)}px`, height: `${Math.max(8, configStyles.chkSize - 1)}px` }}
                />
                <span className="font-extrabold whitespace-nowrap">
                  {safeFrame ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          {/* Linha 2: TOGGLE AREA - Estilo IA, Preparar Cena, Redes Sociais */}
          <div 
            className="toggle-area flex items-center justify-between w-full shrink-0 min-w-0"
            style={{
              padding: `${configStyles.togglePy}px ${configStyles.togglePx}px`,
              marginTop: `${configStyles.toggleMt}px`,
              gap: `${configStyles.gap}px`
            }}
          >
            <div className="social-group flex items-center ml-auto min-w-0 flex-1 justify-end" style={{ gap: `${configStyles.gap}px` }}>
              <button
                type="button"
                id="btnEstiloIA"
                onClick={handleApplyOptimalStyle}
                className="bg-[#1e4233] hover:bg-[#285743] text-[#4ade80] hover:text-white font-bold rounded flex items-center shadow-xs transition-all hover:scale-102 active:scale-95 cursor-pointer border border-[#4ade80]/40 whitespace-nowrap flex-1 min-w-0 max-w-[120px]"
                style={{
                  padding: `${configStyles.btnPy}px ${configStyles.btnPx}px`,
                  fontSize: configStyles.btnFont,
                  gap: `${configStyles.gap/2}px`
                }}
                title="Aplicar Estilo Ideal para IA nas Cenas do SketchUp (Texturas nítidas, arestas finas 1px, sombras ativadas, sem eixos/guias)"
              >
                <Palette style={{ width: `${configStyles.iconSize}px`, height: `${configStyles.iconSize}px` }} className="text-[#4ade80] shrink-0" />
                <span className={configHeight < 65 ? 'hidden' : 'truncate'}>{t.ai_style}</span>
              </button>
              <button
                type="button"
                id="btnPrepararCena"
                onClick={() => setShowScenePrepModal(true)}
                className="bg-[#28503d] hover:bg-[#34664e] text-white font-bold rounded flex items-center shadow-xs transition-all hover:scale-102 active:scale-95 cursor-pointer border border-[#4ade80]/40 whitespace-nowrap flex-1 min-w-0 max-w-[130px]"
                style={{
                  padding: `${configStyles.btnPy}px ${configStyles.btnPx}px`,
                  fontSize: configStyles.btnFont,
                  gap: `${configStyles.gap/2}px`
                }}
                title="Preparar a Cena (Comandos e Automação do SketchUp)"
              >
                <Sparkles style={{ width: `${configStyles.iconSize}px`, height: `${configStyles.iconSize}px` }} className="text-[#4ade80] shrink-0" />
                <span className={configHeight < 65 ? 'hidden' : 'truncate'}>{t.prepare_scene}</span>
              </button>
              <div className="flex items-center shrink-0 flex-nowrap" style={{ gap: `${configStyles.gap}px` }}>
                <GemIcon 
                  className="btn-social shrink-0" 
                  size={configStyles.socialSize}
                  onClick={handleOpenGem} 
                />
                <OrangeGemIcon 
                  className="btn-social shrink-0" 
                  size={configStyles.socialSize}
                  onClick={handleOpenBase44} 
                />
                <PurpleGemIcon 
                  className="btn-social shrink-0" 
                  size={configStyles.socialSize}
                  onClick={handleOpenSkpIa02} 
                />

                {/* Botão de Download do Ruby Plugin (.rb) */}
                <button
                  type="button"
                  onClick={handleDownloadRb}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap border shrink-0 ${
                    hasPluginUpdate 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-400 animate-pulse ring-2 ring-orange-400/50' 
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300/80'
                  }`}
                  title={hasPluginUpdate ? "✨ NOVA ATUALIZAÇÃO DISPONÍVEL! Clique para baixar e atualizar o plugin protegido." : "Baixar Plugin Protegido (skp_render_pro_protected.rb) para SketchUp"}
                  style={{ 
                    height: `${configStyles.socialSize}px`,
                    fontSize: configStyles.btnFont
                  }}
                >
                  <Download style={{ width: `${configStyles.iconSize}px`, height: `${configStyles.iconSize}px` }} className={hasPluginUpdate ? 'text-white' : 'text-emerald-700'} />
                  <span className={`font-bold uppercase ${(configHeight < 75 || width < 400) ? 'hidden' : ''}`}>.RB</span>
                  {hasPluginUpdate && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                  )}
                </button>

                {/* SELETOR DE IDIOMA - Agora aqui ao lado do download */}
                <div className="relative flex items-center shrink-0" ref={languageMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                    className="flex items-center justify-center rounded-full border border-stone-300 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer active:scale-90 overflow-hidden bg-white group/lang shrink-0"
                    title={language === 'pt' ? 'Alterar Idioma' : language === 'en' ? 'Change Language' : 'Cambiar Idioma'}
                    style={{ 
                      width: configStyles.socialSize, 
                      height: configStyles.socialSize 
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center scale-150 transition-transform group-hover/lang:scale-160">
                      {language === 'pt' && <BrFlag size={20} />}
                      {language === 'en' && <UsFlag size={20} />}
                      {language === 'es' && <EsFlag size={20} />}
                    </div>
                  </button>
                  
                  {showLanguageMenu && (
                    <div className="absolute top-full right-0 mt-2 bg-white border border-stone-200 rounded-lg shadow-2xl overflow-hidden animate-fade-in min-w-[140px] z-50">
                      {(['pt', 'en', 'es'] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang);
                            setShowLanguageMenu(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-[11.5px] font-bold transition-colors border-b border-stone-50 last:border-0 ${
                            language === lang 
                              ? 'bg-emerald-50 text-emerald-900' 
                              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                          }`}
                        >
                          <div className="shrink-0 flex items-center shadow-xs rounded-xs overflow-hidden border border-stone-100">
                            {lang === 'pt' && <BrFlag size={18} />}
                            {lang === 'en' && <UsFlag size={18} />}
                            {lang === 'es' && <EsFlag size={18} />}
                          </div>
                          <span className="flex-1 truncate">
                            {lang === 'pt' ? 'Português' : lang === 'en' ? 'English' : 'Español'}
                          </span>
                          {language === lang && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Botão discreto de Admin - Visível APENAS fora do SketchUp. REGRA DE OURO: NUNCA no SketchUp */}
              {!isInsideSketchup && (
                <button
                  type="button"
                  onClick={handleOpenAdminPanel}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 border border-stone-200 rounded transition cursor-pointer whitespace-nowrap shrink-0"
                  title="Painel Administrativo de Licenças"
                  style={{ 
                    height: `${configStyles.socialSize}px`,
                    fontSize: configStyles.btnFont
                  }}
                >
                  <Key style={{ width: `${configStyles.iconSize}px`, height: `${configStyles.iconSize}px` }} className="text-stone-500" />
                  <span className={`font-medium ${(configHeight < 75 || width < 400) ? 'hidden' : ''}`}>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* Config Resizer Handle na borda inferior do painel de configuração */}
          <div 
            onMouseDown={startResizingConfig}
            className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-emerald-500/40 transition-colors z-20 group"
            title="Arraste para ajustar a altura da barra de configurações"
          >
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 px-3 py-0 bg-white border border-stone-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none shadow-xs">
               <div className="w-6 h-0.5 bg-stone-300 rounded-full" />
            </div>
          </div>
        </div>

      {/* CHAT AREA */}
      <div 
        className="chat-area flex-1 min-h-0 overflow-y-auto relative" 
        ref={chatAreaRef}
        onScroll={handleChatScroll}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`msg ${msg.sender === 'user' ? 'user' : 'ia'} transition-all`}
            style={{ whiteSpace: 'pre-line' }}
          >
            {msg.image && (
              <div className="flex flex-col gap-2 w-full">
                <img 
                  src={msg.image} 
                  alt={msg.sender === 'ia' ? "Fotografia Ultra Realista IA" : "Render / Print SketchUp"} 
                  className="msg-media cursor-pointer hover:opacity-95 transition"
                  onClick={() => setPreviewImage(msg.image || null)}
                  onLoad={() => scrollToBottom('smooth')}
                  title="Clique para ampliar a imagem"
                />

                {/* Linha 1 de Botões: SALVAR à esquerda, COPIAR PRINT à direita (ajustáveis à largura) */}
                <div className="grid grid-cols-2 gap-1.5 mt-0.5 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (msg.isImported) {
                        downloadImageWithExactResolution(msg.image!, -1, -1, msg.sender === 'ia' ? 'Render_Pro_IA' : 'Imagem_Importada');
                      } else {
                        const targetW = msg.imageWidth || width;
                        const targetH = msg.imageHeight || height;
                        downloadImageWithExactResolution(msg.image!, targetW, targetH, msg.sender === 'ia' ? 'Render_Pro_IA' : 'SKP_Render');
                      }
                    }}
                    className="w-full min-w-0 px-2 py-1.5 bg-[#9AAEA3] hover:bg-[#8ca296] text-[#1F4936] text-[10.5px] font-bold rounded-md flex items-center justify-center gap-1 transition cursor-pointer shadow-sm active:scale-95 overflow-hidden"
                    title={msg.isImported ? `Salvar na dimensão real da imagem (${msg.imageWidth}x${msg.imageHeight}px)` : `Salvar arquivo da imagem no computador com resolução exata (${msg.imageWidth || width}x${msg.imageHeight || height}px)`}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">SALVAR ({msg.isImported ? (msg.imageWidth && msg.imageHeight ? `${msg.imageWidth}x${msg.imageHeight}` : 'Original') : `${msg.imageWidth || width}x${msg.imageHeight || height}`})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (msg.isImported) {
                        handleCopyImage(msg.image!, `img-${msg.id}`, -1, -1);
                      } else {
                        const targetW = msg.imageWidth || width;
                        const targetH = msg.imageHeight || height;
                        handleCopyImage(msg.image!, `img-${msg.id}`, targetW, targetH);
                      }
                    }}
                    className="w-full min-w-0 px-2 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-[10.5px] font-bold rounded-md flex items-center justify-center gap-1 border border-white/20 transition cursor-pointer shadow-sm active:scale-95 overflow-hidden"
                    title={msg.isImported ? `Copiar na dimensão original (${msg.imageWidth}x${msg.imageHeight}px)` : `Copiar com resolução (${msg.imageWidth || width}x${msg.imageHeight || height}px)`}
                  >
                    {copiedId === `img-${msg.id}` ? <Check className="w-3.5 h-3.5 shrink-0 text-[#4ade80]" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{copiedId === `img-${msg.id}` ? 'COPIADO!' : (msg.sender === 'ia' ? 'COPIAR FOTO' : 'COPIAR PRINT')}</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Conteúdo da Mensagem: Usuário vs IA */}
            {msg.sender === 'user' ? (
              <>
                {editingMessageId === msg.id ? (
                  <div className="mt-2 p-2 bg-white/95 rounded-md border border-stone-300 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                      <span className="flex items-center gap-1">
                        <Pencil className="w-3.5 h-3.5 shrink-0" /> {t.edit_message_title}
                      </span>
                      <span className="text-[10px] text-stone-500 font-normal">{t.edit_message_hint}</span>
                    </div>
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full text-xs p-2 border border-stone-300 rounded focus:border-[#396252] focus:ring-1 focus:ring-[#396252] outline-none resize-y font-sans leading-relaxed text-stone-900"
                      placeholder={t.edit_message_placeholder}
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded transition cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveAndRegenerate(msg.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50 border border-white/60"
                      >
                        <RotateCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{t.save_regenerate}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  msg.text && (
                    <div className="mt-2 flex flex-col gap-1 w-full">
                      {msg.text.length > 300 ? (
                        <div className="w-full flex flex-col">
                          <div 
                            className={`font-bold text-white text-[13px] tracking-wide break-words overflow-hidden transition-all duration-300 ${expandedMessages.has(msg.id) ? 'max-h-[none]' : 'max-h-[72px] relative'}`}
                          >
                            {msg.text}
                            {!expandedMessages.has(msg.id) && (
                              <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#2c5842] to-transparent pointer-events-none" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleMessageExpansion(msg.id)}
                            className="text-[10.5px] text-[#a7f3d0] font-extrabold mt-1.5 underline cursor-pointer self-start hover:text-white transition-colors"
                          >
                            {expandedMessages.has(msg.id) ? t.hide_details : t.view_full_list}
                          </button>
                        </div>
                      ) : (
                        <div className="font-bold text-white text-[13px] tracking-wide break-words">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Linha 2 de Botões: EDITAR MENSAGEM à esquerda, Salvar e Refazer à direita (ajustáveis à largura) */}
                {editingMessageId !== msg.id && (
                    <div className="grid grid-cols-2 gap-1.5 mt-2 pt-1.5 border-t border-white/15 w-full">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(msg)}
                        className="w-full min-w-0 px-2 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-[10.5px] font-bold rounded-md flex items-center justify-center gap-1 border border-[#4ade80]/50 transition cursor-pointer shadow-sm active:scale-95 overflow-hidden"
                        title="Editar a mensagem deste print para refazer a imagem com a IA"
                      >
                        <Pencil className="w-3.5 h-3.5 shrink-0 text-[#4ade80]" />
                        <span className="truncate">{t.edit_message}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveAndRegenerate(msg.id, msg.text)}
                        disabled={isLoading}
                        className="w-full min-w-0 px-2 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-[10.5px] font-bold rounded-md flex items-center justify-center gap-1 border border-white/80 hover:border-white transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 overflow-hidden"
                        title="Salvar e refazer a imagem imediatamente com a IA mantendo a mensagem atual"
                      >
                        <RotateCw className={`w-3.5 h-3.5 shrink-0 text-white ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="truncate">{t.save_regenerate}</span>
                      </button>
                    </div>
                )}

              </>
            ) : (
              /* Mensagem da IA: Exibe o prompt com o botão de copiar e toggle de expansão */
              <div className="mt-2 w-full flex flex-col">
                {/* Header do Prompt (Sempre visível para mensagens longas ou com masterPrompt) */}
                {(msg.masterPrompt || msg.text.length > 200) ? (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2.5 bg-[#eaf3ee] rounded-t-lg border border-[#2c5842]/30 w-full shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleMessageExpansion(msg.id)}
                        className="flex items-center gap-2 text-[11px] font-bold text-[#25543f] uppercase tracking-wider cursor-pointer hover:opacity-80 transition-all flex-1 text-left"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#25543f] shrink-0" />
                        <span className="truncate">
                          {expandedMessages.has(msg.id) ? `✨ ${t.prompt_generated} COMPLETO` : `✨ ${t.prompt_generated}`}
                        </span>
                        {expandedMessages.has(msg.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.masterPrompt || msg.text, `msg-${msg.id}`)}
                        className="px-3 py-1.5 bg-[#25543f] hover:bg-[#1a3d2e] text-white text-[11px] font-bold rounded-md flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer border border-[#4ade80]/50 shrink-0"
                        title="Copiar prompt completo para a área de transferência"
                      >
                        {copiedId === `msg-${msg.id}` ? <Check className="w-3 h-3.5 text-[#4ade80]" /> : <Copy className="w-3 h-3.5" />}
                        <span>{copiedId === `msg-${msg.id}` ? t.copied.replace('!', '') : t.copy_prompt}</span>
                      </button>
                    </div>

                    {/* Conteúdo Expansível */}
                    <div className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${expandedMessages.has(msg.id) ? 'max-h-[none] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="p-3 bg-white border-x border-b border-[#2c5842]/20 rounded-b-lg">
                        {renderFormattedPrompt(msg.masterPrompt || msg.text)}
                      </div>
                    </div>

                    {/* Dica discreta se estiver colapsado */}
                    {!expandedMessages.has(msg.id) && (
                      <div 
                        className="text-[10px] text-[#396252]/60 italic pl-1 cursor-pointer hover:underline"
                        onClick={() => toggleMessageExpansion(msg.id)}
                      >
                        {t.click_to_expand}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Mensagem curta: Exibe normalmente */
                  <div className="w-full">
                    {renderFormattedPrompt(msg.text)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="msg ia animate-pulse flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#396252] animate-bounce" />
            <span className="inline-block w-2 h-2 rounded-full bg-[#396252] animate-bounce [animation-delay:0.2s]" />
            <span className="inline-block w-2 h-2 rounded-full bg-[#396252] animate-bounce [animation-delay:0.4s]" />
            <span>Escaneando print...</span>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
        
        {/* Botão flutuante para descer até a mensagem mais recente quando o usuário rolou pra cima */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="sticky bottom-2 ml-auto mr-2 bg-[#1F4936] hover:bg-[#163d2c] text-white px-3 py-1.5 rounded-full shadow-lg border border-[#4ade80]/50 z-20 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 animate-fade-in"
            title="Rolar para a mensagem mais recente"
          >
            <ChevronDown className="w-4 h-4 text-[#4ade80]" />
            <span className="text-[11px] font-sans">Nova mensagem</span>
          </button>
        )}
      </div>

      {/* FLOATING TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-[#396252] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-1.5 animate-fade-in border border-[#4ade80]/40">
          <Check className="w-4 h-4 text-[#4ade80]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* BARRA DE MATERIAIS IDENTIFICADOS - DISCRETA PARA NÃO POLUIR O CHAT */}
      {detectedMaterials.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#eaf3ee] border-t border-[#2c5842]/25 text-xs shrink-0 shadow-2xs">
          <div className="flex items-center gap-1.5 text-[#1c4432] font-semibold text-[11px] truncate">
            <Sparkles className="w-3.5 h-3.5 text-[#25543f] shrink-0" />
            <span className="truncate">{detectedMaterials.length} {t.detected_materials}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetectedMaterials([])}
              className="p-1 hover:bg-white/40 rounded transition cursor-pointer text-[#25543f]"
              title="Fechar e limpar materiais detectados"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div 
        className="footer shrink-0 relative flex flex-col bg-white border-t border-stone-200"
        style={{ height: `${footerHeight}px` }}
      >
        {/* Footer Resizer Handle */}
        <div 
          onMouseDown={startResizingFooter}
          className="absolute top-0 left-0 w-full h-1 cursor-row-resize hover:bg-emerald-500/40 transition-colors z-30 group"
        >
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 px-3 py-0 bg-white border border-stone-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
             <div className="w-6 h-0.5 bg-stone-300 rounded-full" />
          </div>
        </div>

        <div className="flex-1 flex flex-col px-2.5 pt-1.5 pb-2 gap-1.5 overflow-hidden justify-center">
          {/* BOTÕES DE AÇÃO: Somem quando o rodapé diminui demais (abaixo de 115px) */}
          {footerHeight >= 115 && (
            <div className="print-group flex items-center gap-2 overflow-hidden shrink-0">
              <button 
                type="button"
                className="btn-action btn-print flex-1 py-1 text-xs font-bold rounded transition-all active:scale-95 h-8.5"
                onClick={handleRender}
                title="Enviar comando ou renderizar cena com IA"
              >
                {t.send}
              </button>
              {/* Botão Materiais e Objetos - Abre nova interface dentro do SketchUp */}
              <button
                type="button"
                onClick={() => handleOpenMaterialsInSketchup()}
                disabled={isDetectingMaterials}
                className="px-3 py-1 text-xs font-bold rounded transition-all active:scale-95 h-8.5 bg-[#eaf3ee] hover:bg-[#d8e8df] text-[#1c4432] border border-[#2c5842]/40 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 min-w-0"
                title="Abre a interface de Materiais e Objetos em uma nova janela dentro do SketchUp com leitura profunda da cena"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#25543f] shrink-0 ${isDetectingMaterials ? 'animate-spin' : ''}`} />
                <span className="whitespace-nowrap truncate">{isDetectingMaterials ? t.scanning : t.materials_objects}</span>
              </button>
              {/* Botão Galeria - Abre modal de histórico de imagens e prompts */}
              <button 
                type="button"
                id="btnGallery"
                className="btn-action flex-1 py-1 text-xs font-bold rounded transition-all active:scale-95 h-8.5 bg-[#396252] hover:bg-[#2b4c3e] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                onClick={() => setShowGalleryModal(true)}
                title="Abrir Galeria de Histórico de Imagens e Prompts"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#4ade80]" />
                <span className="truncate">{t.gallery || 'Galeria'}</span>
              </button>
            </div>
          )}

          {/* Badge de visualização da imagem selecionada (aparece se houver espaço) */}
          {attachedImage && footerHeight >= 140 && (
            <div className="image-preview-badge flex items-center justify-between gap-1.5 p-1 bg-[#eef3f0] border border-[#9AAEA3] rounded shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <img src={attachedImage} alt="Preview" className="image-preview-thumb w-6 h-6 rounded object-cover border border-stone-300" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate max-w-[130px] text-[10px] font-bold text-[#396252]">{attachedImageName || (attachedImageMeta?.isImported ? 'Imagem Importada' : 'Print')}</span>
                  {attachedImageMeta?.isImported && (
                    <span className="text-[8.5px] text-stone-600 font-semibold truncate leading-tight">
                      {attachedImageMeta.naturalWidth}x{attachedImageMeta.naturalHeight}px (Real)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenMaterialsInSketchup()}
                  disabled={isDetectingMaterials}
                  className="px-2 py-1 bg-[#25543f] hover:bg-[#1a3d2e] text-white rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Abrir interface de Materiais e Objetos dentro do SketchUp"
                >
                  <Sparkles className={`w-3 h-3 ${isDetectingMaterials ? 'animate-spin' : ''}`} />
                  <span>{isDetectingMaterials ? 'Lendo...' : 'Materiais'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenMaterialsInSketchup()}
                  className="p-1 bg-[#dbe8df] hover:bg-[#c9ddd0] text-[#1c4432] rounded transition cursor-pointer shadow-2xs"
                  title="Abrir nova interface dentro do SketchUp"
                >
                  <Maximize2 className="w-3 h-3 text-[#25543f]" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (attachedImageMeta?.isImported) {
                      downloadImageWithExactResolution(attachedImage, -1, -1, attachedImageName ? attachedImageName.replace(/\.[^/.]+$/, '') : 'Imagem_Importada');
                    } else {
                      downloadImageWithExactResolution(attachedImage, width, height, 'Print_SketchUp');
                    }
                  }}
                  className="p-1 bg-[#4B6B5B] text-white rounded hover:bg-[#396252] transition cursor-pointer"
                  title={attachedImageMeta?.isImported ? `Salvar Imagem na Dimensão Real (${attachedImageMeta.naturalWidth}x${attachedImageMeta.naturalHeight}px)` : `Salvar Print no Computador (${width}x${height}px)`}
                >
                  <Download className="w-3 h-3" />
                </button>
                <button 
                  type="button" 
                  onClick={removeAttachedImage}
                  className="p-1 text-stone-500 hover:text-red-600 cursor-pointer"
                  title="Remover imagem"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Badge de Lote Ativo com múltiplas cenas do mesmo ambiente */}
          {batchScenes.length > 0 && footerHeight >= 125 && (
            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 bg-[#eaf3ee] border border-[#2c5842]/40 rounded text-xs shrink-0 shadow-2xs">
              <div className="flex items-center gap-1.5 truncate">
                <span className="bg-[#113222] text-[#4ade80] font-black px-1.5 py-0.2 rounded text-[10px] font-mono border border-[#4ade80]/40">
                  ++
                </span>
                <span className="font-bold text-[#113222] text-[11px] truncate">
                  Lote Ativo: {batchScenes.length} cena(s) do mesmo ambiente
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  className="px-2 py-0.5 bg-[#1c4432] hover:bg-[#163829] text-white rounded text-[10px] font-bold transition cursor-pointer"
                >
                  Abrir Lote
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchScenes([]);
                    showToast('Lote de cenas limpo.');
                  }}
                  className="px-1 text-stone-500 hover:text-red-600 transition cursor-pointer"
                  title="Limpar lote"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* CAIXA DE MENSAGEM, BOTÃO + E BOTÃO SKP: NUNCA SOMEM */}
          <div className="input-box-container flex-1 flex flex-col min-h-0 justify-center">
            <div 
              className="input-row flex-1 flex items-stretch gap-1 sm:gap-1.5 w-full"
              style={{ minHeight: `${footerHeight < 60 ? 28 : 36}px` }}
            >
              {/* Input oculto para importação de imagem do computador (+ IMG) */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
              />

              {/* Input oculto para importação em lote de imagens (LOTE ++) */}
              <input 
                type="file" 
                ref={batchFileInputRef} 
                className="hidden" 
                accept="image/*" 
                multiple
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    await handleBatchFiles(e.target.files);
                    setShowBatchModal(true);
                  }
                  e.target.value = '';
                }} 
              />

              {/* BOTÃO DE + NA CAIXA DE MENSAGEM (NUNCA SOME) */}
              <button
                type="button"
                id="btnAddImage"
                className="btn-add-img shrink-0 flex flex-col items-center justify-center border border-stone-300 rounded transition hover:bg-stone-50 overflow-hidden"
                style={{ 
                  height: '100%', 
                  minHeight: `${footerHeight < 60 ? 28 : 36}px`, 
                  width: footerHeight < 60 ? '30px' : '38px' 
                }}
                onClick={() => fileInputRef.current?.click()}
                title={attachedImage ? "Imagem anexada (clique para trocar)" : "Importar imagem única do computador"}
              >
                {attachedImage ? (
                  <div className="relative w-full h-full p-0.5 flex items-center justify-center bg-emerald-50">
                    <img src={attachedImage} alt="Img" className="w-full h-full object-cover rounded" />
                    <span className="absolute -top-0.5 -right-0.5 bg-emerald-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">✓</span>
                  </div>
                ) : (
                  <>
                    <span className={`font-bold text-stone-500 leading-none ${footerHeight < 60 ? 'text-sm' : 'text-base'}`}>+</span>
                    <span className="text-[7px] font-bold text-stone-500 uppercase tracking-tight">IMG</span>
                  </>
                )}
              </button>

              {/* BOTÃO DE ++ (LEITURA EM LOTE / MÚLTIPLAS CENAS DO MESMO AMBIENTE) */}
              <button
                type="button"
                id="btnBatchAdd"
                className={`btn-add-img shrink-0 flex flex-col items-center justify-center border rounded transition active:scale-95 overflow-hidden cursor-pointer ${
                  batchScenes.length > 0
                    ? 'bg-[#1c4432] border-[#2c5842] text-white shadow-xs'
                    : 'bg-[#eaf3ee] hover:bg-[#dbe9e0] border-[#9AAEA3] text-[#1c4432]'
                }`}
                style={{ 
                  height: '100%', 
                  minHeight: `${footerHeight < 60 ? 28 : 36}px`, 
                  width: footerHeight < 60 ? '30px' : '38px' 
                }}
                onClick={() => {
                  if (batchScenes.length > 0) {
                    setShowBatchModal(true);
                  } else {
                    batchFileInputRef.current?.click();
                  }
                }}
                title="Leitura em Lote (++) — Adicionar múltiplas cenas do mesmo ambiente para gerar materiais e iluminação 100% uniformes"
              >
                {batchScenes.length > 0 ? (
                  <div className="relative w-full h-full p-0.5 flex flex-col items-center justify-center">
                    <span className="font-black text-[#4ade80] text-[11px] leading-none">++</span>
                    <span className="text-[6.5px] font-black uppercase tracking-tight text-white leading-none mt-0.5">{batchScenes.length}</span>
                  </div>
                ) : (
                  <>
                    <span className={`font-black text-[#1c4432] leading-none ${footerHeight < 60 ? 'text-xs' : 'text-sm'}`}>++</span>
                    <span className="text-[7px] font-black text-[#1c4432] uppercase tracking-tight leading-none mt-0.5">LOTE</span>
                  </>
                )}
              </button>

              {/* TEXTAREA DA CAIXA DE MENSAGEM (NUNCA SOME) */}
              <textarea 
                id="promptInput"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex-1 min-w-0 h-full p-1.5 sm:p-2 text-xs sm:text-sm border border-stone-300 rounded focus:border-[#396252] focus:ring-1 focus:ring-[#396252] outline-none resize-none bg-white font-sans leading-tight text-stone-900"
                style={{ minHeight: `${footerHeight < 60 ? 28 : 36}px` }}
                placeholder={footerHeight < 80 ? "Digite o comando (Enter)..." : "Digite o comando ou dúvida sobre a cena SketchUp..."}
              />

              {/* BOTÃO RÁPIDO DE CAPTURAR TELA DO SKETCHUP (NUNCA SOME) */}
              <button
                type="button"
                id="btnQuickCaptureSkp"
                className="btn-add-img shrink-0 flex flex-col items-center justify-center border border-stone-300 rounded transition hover:bg-stone-50 active:scale-95"
                style={{ 
                  height: '100%', 
                  minHeight: `${footerHeight < 60 ? 28 : 36}px`, 
                  width: footerHeight < 60 ? '30px' : '38px' 
                }}
                onClick={() => handleCaptureSketchUp()}
                disabled={isCapturing}
                title="📸 Capturar tela do SketchUp"
              >
                <Camera className={`w-4 h-4 text-emerald-800 ${isCapturing ? 'animate-pulse text-emerald-500' : ''}`} />
                <span className="text-[7.5px] font-bold text-emerald-800 uppercase tracking-tight">SKP</span>
              </button>

              {/* BOTÃO COM NÚMERO 360 (CAPTURAR PRINT 360° PANORÂMICO) */}
              <button
                type="button"
                id="btn360"
                className={`btn-add-img shrink-0 flex flex-col items-center justify-center border rounded transition active:scale-95 cursor-pointer ${
                  isCapturing360
                    ? 'bg-emerald-600 border-emerald-700 text-white animate-pulse'
                    : is360Mode 
                      ? 'bg-[#396252] border-[#25543f] text-white shadow-xs hover:bg-[#2e4f42]' 
                      : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
                style={{ 
                  height: '100%', 
                  minHeight: `${footerHeight < 60 ? 28 : 36}px`, 
                  width: footerHeight < 60 ? '30px' : '38px' 
                }}
                onClick={() => handleCapture360()}
                disabled={isCapturing || isCapturing360}
                title="🌐 Capturar Print em 360° Panorâmico (Proporção 2:1 - 4096x2048px)"
              >
                <span className={`font-black tracking-tighter leading-none ${footerHeight < 60 ? 'text-[11px]' : 'text-xs'} ${isCapturing360 || is360Mode ? 'text-white' : 'text-[#396252]'}`}>
                  360
                </span>
                <span className={`text-[6.5px] font-extrabold uppercase tracking-tight leading-none mt-0.5 ${isCapturing360 || is360Mode ? 'text-emerald-100' : 'text-stone-500'}`}>
                  {isCapturing360 ? '...' : is360Mode ? 'ON' : 'VR'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {footerHeight >= 160 && (
          <div className="hint flex items-center justify-center gap-3 px-2 py-0.5 shrink-0 opacity-50">
            <span className="text-[9px] text-gray-400">Enter para enviar • 📸 SKP para capturar • 🌐 360 para panorama</span>
            <span className="text-[8px] text-gray-400 font-mono">v1.0</span>
          </div>
        )}
      </div>

      {/* Camera Viewport & Safe Frame Modal */}
      <CameraOverlay 
        config={{
          ratio,
          width,
          height,
        }}
        isOpen={showOverlayModal}
        onClose={() => setShowOverlayModal(false)}
        onExport={handleSave}
      />

      <Gallery 
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        onSelectPrompt={(p) => setInput(p)}
        onCopyText={(t) => handleCopyText(t, 'gallery')}
        onCopyImage={(img, id) => handleCopyImage(img, id)}
        onShowToast={(m) => showToast(m)}
        bottomOffset={footerHeight}
      />

      {/* Lightbox fullscreen preview modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center">
            <img 
              src={previewImage} 
              alt="Visualização ampliada" 
              className="max-h-[85vh] max-w-[95vw] object-contain rounded shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="mt-3 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold transition cursor-pointer tracking-wider uppercase"
            >
              FECHAR VISUALIZAÇÃO
            </button>
          </div>
        </div>
      )}
      {/* Scene Preparation Modal */}
      <ScenePrepModal
        isOpen={showScenePrepModal}
        onClose={() => setShowScenePrepModal(false)}
        onToast={showToast}
        ratio={ratio}
        width={width}
        height={height}
        safeFrame={safeFrame}
        onUpdateFormat={(newRatio, newW, newH) => {
          setRatio(newRatio);
          setWidth(newW);
          setHeight(newH);
          sync(newRatio, newW, newH, safeFrame);
        }}
        onToggleSafeFrame={(enabled) => {
          setSafeFrame(enabled);
          sync(ratio, width, height, enabled);
        }}
      />

      {/* License Manager Modal */}
      <LicenseManagerModal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onCopyText={handleCopyText}
        copiedId={copiedId}
      />

      {/* Admin Password Prompt Modal */}
      {showPasswordPrompt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none animate-fade-in"
          onClick={() => setShowPasswordPrompt(false)}
        >
          <div 
            className="bg-[#11241C] border border-[#2B5E46] rounded-2xl w-full max-w-xs p-5 shadow-2xl text-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#244A37]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#1B3F2E] border border-[#306C4F] flex items-center justify-center text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Acesso Restrito</h3>
                  <p className="text-[10px] text-gray-400">Painel do Desenvolvedor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordPrompt(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] text-gray-300 mb-1.5 font-medium">
                  Digite a senha de administrador:
                </label>
                <input
                  type="password"
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-[#0C1A14] border border-[#2D5A44] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-center tracking-widest font-mono"
                />
                {passwordError && (
                  <p className="text-[11px] text-red-400 mt-1.5 text-center font-medium">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordPrompt(false)}
                  className="flex-1 py-2 px-3 bg-[#1A382B] hover:bg-[#254F3D] text-xs text-gray-300 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl shadow transition cursor-pointer"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AMPLO DE MATERIAIS E OBJETOS DA CENA (DENTRO DO PLUGIN) */}
      {showMaterialsModal && (
        <MaterialsEditorModal
          materials={detectedMaterials}
          image={attachedImage || (messages.length ? messages.slice().reverse().find((m) => Boolean(m.image))?.image : null)}
          imageName={attachedImage ? (attachedImageName || 'Print em Espera para Envio') : (attachedImageName || 'Cena 3D SketchUp')}
          onUpdateMaterial={handleUpdateMaterial}
          onDeleteMaterial={handleDeleteMaterial}
          onAddMaterial={handleAddMaterial}
          onClearMaterials={handleClearMaterials}
          isDetecting={isDetectingMaterials}
          onDetectMaterials={() => handleDetectMaterials(attachedImage || undefined)}
          onClose={() => setShowMaterialsModal(false)}
          onOpenExternalWindow={() => handleOpenMaterialsExternalWindow()}
          isPopoutWindow={false}
        />
      )}

      {/* MODAL DE GERAÇÃO E PRÉVIA DE PANORAMA 360° COM IA */}
      <Panorama360Modal
        isOpen={showPanorama360Modal}
        onClose={() => setShowPanorama360Modal(false)}
        onUsePanorama={handleUsePanorama360}
        showToast={showToast}
      />

      {/* MODAL DE LEITURA E GERAÇÃO EM LOTE DE CENAS DO MESMO AMBIENTE */}
      <BatchScenesModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        scenes={batchScenes}
        onUpdateScenes={setBatchScenes}
        onAddFiles={handleBatchFiles}
        onCaptureSkpView={handleCaptureSkpForBatch}
        language={language}
        showToast={showToast}
        onApplyBatchToChat={handleApplyBatchToChat}
        isInsideSketchup={isInsideSketchup}
      />
    </>
    </div>
  );
}
