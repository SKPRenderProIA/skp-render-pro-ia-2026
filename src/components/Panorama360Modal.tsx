import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Eye, 
  Compass, 
  Maximize2, 
  Check, 
  RotateCw, 
  Download, 
  Sparkles, 
  Camera, 
  Layers,
  ZoomIn,
  ZoomOut,
  Info,
  ArrowUpDown,
  ArrowLeftRight,
  Upload
} from 'lucide-react';
import * as THREE from 'three';
import { 
  CubemapFaces, 
  stitchCubemapToEquirectangular, 
  generateSynthetic360Panorama,
  flipImageVertically,
  flipImageHorizontally
} from '../utils/panorama360';
import { safeStorage } from '../lib/safeStorage';

interface Panorama360ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsePanorama: (imageDataUrl: string, resolution: { width: number; height: number }, openMaterialsCenter?: boolean) => void;
  onSyncPanorama?: (imageDataUrl: string, resolution: { width: number; height: number }) => void;
  showToast: (msg: string) => void;
}

export const Panorama360Modal: React.FC<Panorama360ModalProps> = ({
  isOpen,
  onClose,
  onUsePanorama,
  onSyncPanorama,
  showToast,
}) => {
  // Passos de configuração
  const [wallSelected, setWallSelected] = useState<boolean>(false);
  const [observerPlaced, setObserverPlaced] = useState<boolean>(false);
  const [eyeHeight, setEyeHeight] = useState<number>(1.60);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Dados do panorama gerado
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  // Cache das 6 faces capturadas do SketchUp
  const rawFacesRef = useRef<CubemapFaces | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Viewer 360 Three.js ref
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Reseta ou inicializa
  useEffect(() => {
    if (!isOpen) return;

    // Se já houver panorama salvo recente, carrega
    try {
      const saved = safeStorage.getItem('skp_panorama360_active');
      if (saved && !panoramaUrl) {
        setPanoramaUrl(saved);
        setWallSelected(true);
        setObserverPlaced(true);
      }
    } catch (_) {}

    // Escuta canal de sincronização entre janelas (caso o usuário inverta ou gere em outra janela)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('skp_panorama360_channel');
        bc.onmessage = (ev) => {
          if (ev.data?.action === 'set_panorama' && ev.data.dataUrl) {
            setPanoramaUrl(ev.data.dataUrl);
            setWallSelected(true);
            setObserverPlaced(true);
          }
        };
      }
    } catch (_) {}

    // Escuta evento do SketchUp quando as 6 faces do cubemap estiverem prontas
    const handleCubemapReady = async (e: any) => {
      try {
        const faces: CubemapFaces = e.detail?.faces;
        if (faces && faces.front && faces.right) {
          rawFacesRef.current = faces;
          showToast('Costurando 6 faces em Panorama 360° Ultra HD 8K (8000x4000)...');
          const equirectUrl = await stitchCubemapToEquirectangular(faces, 8000, 4000);
          setPanoramaUrl(equirectUrl);
          setWallSelected(true);
          setObserverPlaced(true);
          setIsCapturing(false);
          try {
            safeStorage.setItem('skp_panorama360_active', equirectUrl);
          } catch (_) {}
          if (onSyncPanorama) {
            onSyncPanorama(equirectUrl, { width: 8000, height: 4000 });
          }
          showToast('✓ Panorama 360° gerado e carregado na Central de Leitura (++)!');
        }
      } catch (err) {
        console.error('Erro ao costurar cubemap 360:', err);
        setIsCapturing(false);
        showToast('Erro ao processar faces 360°. Usando gerador alternativo.');
      }
    };

    // Escuta evento quando o usuário selecionou parede ou observador no SketchUp
    const handlePointDefined = (e: any) => {
      const type = e.detail?.type;
      if (type === 'wall') {
        setWallSelected(true);
        showToast('✓ Parede de frente selecionada!');
      } else if (type === 'observer') {
        setObserverPlaced(true);
        showToast('✓ Observador posicionado no piso!');
      }
    };

    window.addEventListener('skp-360-cubemap-ready', handleCubemapReady);
    window.addEventListener('skp-360-ponto-definido', handlePointDefined);

    return () => {
      window.removeEventListener('skp-360-cubemap-ready', handleCubemapReady);
      window.removeEventListener('skp-360-ponto-definido', handlePointDefined);
      if (bc) bc.close();
    };
  }, [isOpen]);

  // Abertura da Prévia 360 em Interface Separada (Janela Nativa do SketchUp)
  const handleExpandPreview = () => {
    if (panoramaUrl) {
      try {
        safeStorage.setItem('skp_panorama360_active', panoramaUrl);
      } catch (_) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('skp_panorama360_channel');
          bc.postMessage({ action: 'set_panorama', dataUrl: panoramaUrl });
          bc.close();
        }
      } catch (_) {}
    }

    // 1. No SketchUp: aciona a criação do UI::HtmlDialog nativo separado no SketchUp
    if ((window as any).sketchup?.abrir_dialogo_360) {
      try {
        (window as any).sketchup.abrir_dialogo_360(panoramaUrl || '');
        showToast('✓ Prévia 360° aberta em janela dedicada do SketchUp!');
        return;
      } catch (err) {
        console.warn('Erro ao chamar abrir_dialogo_360:', err);
      }
    }

    // 2. Fallback caso use versão com abrir_dialogo_materiais
    if ((window as any).sketchup?.abrir_dialogo_materiais) {
      const currentOrigin = window.location.origin;
      const currentPath = window.location.pathname;
      const popoutUrl = `${currentOrigin}${currentPath}?popout=panorama360&inside_skp=1&skp=1&t=${Date.now()}`;
      try {
        (window as any).sketchup.abrir_dialogo_materiais(popoutUrl);
        showToast('✓ Prévia 360° aberta em janela dedicada do SketchUp!');
        return;
      } catch (_) {}
    }

    // 3. Fora do SketchUp (navegador comum): abre em janela popup/aba dedicada
    try {
      const w = window.open('/?popout=panorama360', 'SkpPanorama360Popout', 'width=1100,height=750,resizable=yes,scrollbars=no');
      if (w) {
        showToast('✓ Prévia 360° aberta em janela separada!');
        return;
      }
    } catch (_) {}

    // Fallback: visualizador interno na tela atual
    setIsViewerOpen(true);
  };

  // Ação Passo 1: Selecionar Parede Frontal
  const handleSelectWall = () => {
    if ((window as any).sketchup?.iniciar_selecao_360) {
      try {
        (window as any).sketchup.iniciar_selecao_360('wall');
        showToast('Clique em uma parede no SketchUp para ser a frente do 360°...');
        return;
      } catch (_) {}
    }
    // Modo simulação no navegador
    setWallSelected(true);
    showToast('Parede frontal definida (Simulação)!');
  };

  // Ação Passo 2: Posicionar Observador no Piso
  const handlePlaceObserver = () => {
    if ((window as any).sketchup?.iniciar_selecao_360) {
      try {
        (window as any).sketchup.iniciar_selecao_360('observer', eyeHeight);
        showToast('Clique no chão da cena no SketchUp para posicionar o observador...');
        return;
      } catch (_) {}
    }
    // Modo simulação no navegador
    setObserverPlaced(true);
    showToast('Observador posicionado no piso a ' + eyeHeight.toFixed(2) + 'm!');
  };

  // Ação Passo 3: Capturar / Gerar o Panorama 360
  const handleGenerate360 = async () => {
    setIsCapturing(true);

    if ((window as any).sketchup?.capturar_cubemap_360) {
      try {
        showToast('Capturando as 6 faces da cena no SketchUp (Alta Resolução 2048px)...');
        (window as any).sketchup.capturar_cubemap_360(eyeHeight, 2048);
        return;
      } catch (err) {
        console.error(err);
      }
    }

    // Se estiver fora do SketchUp ou se o usuário quiser testar imediatamente
    setTimeout(async () => {
      const synthetic = await generateSynthetic360Panorama();
      setPanoramaUrl(synthetic);
      setWallSelected(true);
      setObserverPlaced(true);
      setIsCapturing(false);
      if (onSyncPanorama) {
        onSyncPanorama(synthetic, { width: 8000, height: 4000 });
      }
      showToast('✓ Panorama 360° gerado e sincronizado com a Central de Leitura (++)!');
    }, 700);
  };

  // Limpar configurações
  const handleClear = () => {
    setWallSelected(false);
    setObserverPlaced(false);
    setPanoramaUrl(null);
    rawFacesRef.current = null;
    if ((window as any).sketchup?.cancelar_selecao_360) {
      try {
        (window as any).sketchup.cancelar_selecao_360();
      } catch (_) {}
    }
    showToast('Configurações do 360° limpas.');
  };

  // Inverter imagem verticalmente (corrigir teto/piso)
  const handleFlipVertical = async () => {
    if (!panoramaUrl) return;
    try {
      showToast('Invertendo imagem verticalmente...');
      const fixed = await flipImageVertically(panoramaUrl);
      setPanoramaUrl(fixed);
      if (onSyncPanorama) {
        onSyncPanorama(fixed, { width: 8000, height: 4000 });
      }
      showToast('✓ Imagem invertida verticalmente com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao inverter imagem.');
    }
  };

  // Espelhar imagem horizontalmente
  const handleFlipHorizontal = async () => {
    if (!panoramaUrl) return;
    try {
      showToast('Espelhando imagem horizontalmente...');
      const fixed = await flipImageHorizontally(panoramaUrl);
      setPanoramaUrl(fixed);
      if (onSyncPanorama) {
        onSyncPanorama(fixed, { width: 8000, height: 4000 });
      }
      showToast('✓ Imagem espelhada horizontalmente!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao espelhar imagem.');
    }
  };

  // Carregar imagem 360 externa do usuário
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPanoramaUrl(reader.result);
        setWallSelected(true);
        setObserverPlaced(true);
        if (onSyncPanorama) {
          onSyncPanorama(reader.result, { width: 8000, height: 4000 });
        }
        showToast('✓ Imagem 360° importada e carregada na Central de Leitura (++)!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Inicializa o visualizador Three.js 360 interativo quando `isViewerOpen` é true
  useEffect(() => {
    if (!isViewerOpen || !viewerContainerRef.current || !panoramaUrl) return;

    const container = viewerContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 1100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Cria a esfera invertida
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(panoramaUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    });

    // Controles de arraste do mouse / touch
    let isUserInteracting = false;
    let onPointerDownMouseX = 0;
    let onPointerDownMouseY = 0;
    let lon = 180;
    let onPointerDownLon = 180;
    let lat = 0;
    let onPointerDownLat = 0;
    let phi = 0;
    let theta = 0;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      isUserInteracting = true;
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      onPointerDownMouseX = clientX;
      onPointerDownMouseY = clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;
    };

    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      if (!isUserInteracting) return;
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      lon = (onPointerDownMouseX - clientX) * 0.18 + onPointerDownLon;
      lat = (clientY - onPointerDownMouseY) * 0.18 + onPointerDownLat;
    };

    const onPointerUp = () => {
      isUserInteracting = false;
    };

    const onWheel = (event: WheelEvent) => {
      camera.fov = Math.max(30, Math.min(100, camera.fov + event.deltaY * 0.05));
      camera.updateProjectionMatrix();
    };

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('touchstart', onPointerDown);
    window.addEventListener('touchmove', onPointerMove);
    window.addEventListener('touchend', onPointerUp);
    container.addEventListener('wheel', onWheel);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      lat = Math.max(-85, Math.min(85, lat));
      phi = THREE.MathUtils.degToRad(90 - lat);
      theta = THREE.MathUtils.degToRad(lon);

      const target = new THREE.Vector3();
      target.x = 500 * Math.sin(phi) * Math.cos(theta);
      target.y = 500 * Math.cos(phi);
      target.z = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(target);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      container.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      container.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
    };
  }, [isViewerOpen, panoramaUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs font-sans select-none animate-in fade-in duration-200">
      <div 
        className="bg-stone-900 border border-stone-800 text-stone-100 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800/80 bg-stone-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#396252] flex items-center justify-center text-emerald-100 shadow-inner">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base text-white tracking-tight">Panorama AI</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  360° VR
                </span>
              </div>
              <p className="text-[11px] text-stone-400">Geração e captura de Panorama 360° Equirretangular</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY COM AS 3 ETAPAS */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* TOPO DE CONTEXTO */}
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-semibold text-stone-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-400" />
              Ponto de Vista
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-stone-400 hover:text-stone-200 underline cursor-pointer flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              Limpar tudo
            </button>
          </div>

          {/* PASSO 1: PAREDE DE FRENTE DO PANORAMA */}
          <div className={`p-3.5 rounded-lg border transition ${
            wallSelected 
              ? 'bg-emerald-950/20 border-emerald-800/50 text-stone-200' 
              : 'bg-stone-800/40 border-stone-800 text-stone-300'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-bold flex items-center justify-center border border-stone-700">
                  1
                </span>
                <span className="font-bold text-[13px] text-stone-100">
                  Parede de frente do panorama
                </span>
              </div>
              {wallSelected && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  <Check className="w-3.5 h-3.5" />
                  Definida
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSelectWall}
              className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                wallSelected
                  ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  : 'bg-[#396252] hover:bg-[#2e4f42] text-white shadow-xs'
              }`}
            >
              <Layers className="w-4 h-4" />
              {wallSelected ? 'Trocar parede de frente' : 'Selecionar parede'}
            </button>

            <p className="text-[11px] text-stone-400 mt-2 leading-relaxed">
              Ela fica no centro do 360°. A emenda cai na parede oposta, escolha a bonita.
            </p>
          </div>

          {/* PASSO 2: ONDE VOCÊ FICA DE PÉ */}
          <div className={`p-3.5 rounded-lg border transition ${
            observerPlaced 
              ? 'bg-emerald-950/20 border-emerald-800/50 text-stone-200' 
              : 'bg-stone-800/40 border-stone-800 text-stone-300'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-bold flex items-center justify-center border border-stone-700">
                  2
                </span>
                <span className="font-bold text-[13px] text-stone-100">
                  Onde você fica de pé
                </span>
              </div>
              {observerPlaced && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  <Check className="w-3.5 h-3.5" />
                  Posicionado
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handlePlaceObserver}
              className={`w-full py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer mb-3 ${
                observerPlaced
                  ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  : 'bg-[#396252] hover:bg-[#2e4f42] text-white shadow-xs'
              }`}
            >
              <Eye className="w-4 h-4" />
              {observerPlaced ? 'Reposicionar observador' : 'Posicionar observador'}
            </button>

            {/* ALTURA DO OLHO */}
            <div className="flex items-center justify-between bg-stone-900/60 p-2 rounded border border-stone-800">
              <span className="text-[11px] text-stone-300">Altura do olho</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="3.0"
                  value={eyeHeight}
                  onChange={(e) => setEyeHeight(parseFloat(e.target.value) || 1.60)}
                  className="w-16 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-stone-400 text-xs">m</span>
              </div>
            </div>
          </div>

          {/* PASSO 3: PRÉVIA DO AMBIENTE (EQUIRRETANGULAR 360°) */}
          <div className="p-3.5 rounded-lg border border-stone-800 bg-stone-800/40 text-stone-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-bold flex items-center justify-center border border-stone-700">
                  3
                </span>
                <span className="font-bold text-[13px] text-stone-100">
                  Prévia do ambiente
                </span>
              </div>
              {panoramaUrl && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                  <Check className="w-3.5 h-3.5" />
                  Pronto
                </span>
              )}
            </div>

            {/* ÁREA DE IMAGEM OU BOTÃO DE CAPTURAR */}
            {panoramaUrl ? (
              <div className="space-y-2.5">
                <div className="relative rounded-lg overflow-hidden border border-stone-700 aspect-[2/1] bg-black group">
                  <img
                    src={panoramaUrl}
                    alt="Prévia Equirretangular 360"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleExpandPreview}
                      className="px-3.5 py-2 rounded-md bg-[#285743] hover:bg-[#34664e] text-white text-xs font-bold flex items-center gap-2 shadow-xl border border-[#4ade80]/40 transition active:scale-95 cursor-pointer"
                    >
                      <Maximize2 className="w-4 h-4 text-[#4ade80]" />
                      Abrir Prévia 360° em Janela Separada
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExpandPreview}
                    className="flex-1 py-2 px-3 rounded bg-gradient-to-r from-[#285743] to-[#396252] hover:from-[#34664e] hover:to-[#467a65] text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-[#4ade80]/40 shadow transition active:scale-95 cursor-pointer"
                    title="Abre uma janela dedicada e ampla do SketchUp só para a prévia 360°, sem esticar a tela do plugin"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#4ade80]" />
                    Ampliar em Janela Separada
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerate360}
                    disabled={isCapturing}
                    className="py-2 px-3 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-stone-700 transition cursor-pointer"
                    title="Recapturar cena 360"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                    Recapturar
                  </button>
                </div>

                {/* BOTÃO DIRETO PARA LEITURA DE MATERIAIS E OBJETOS DO 360° NO MESMO LOCAL DO + E ++ */}
                <button
                  type="button"
                  onClick={() => {
                    if (panoramaUrl) {
                      onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, true);
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 border border-[#4ade80]/60 shadow-md transition active:scale-95 cursor-pointer"
                  title="Abre a Central Unificada (++) na aba de Leitura de Materiais e Objetos para este Panorama 360°"
                >
                  <Sparkles className="w-4 h-4 text-[#4ade80]" />
                  <span>🔍 Ler Materiais e Objetos do 360° (Central Unificada ++)</span>
                </button>

                {/* FERRAMENTAS DE AJUSTE RÁPIDO DE ORIENTAÇÃO */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleFlipVertical}
                    className="flex-1 py-1.5 px-2 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-[11px] font-medium flex items-center justify-center gap-1.5 border border-stone-700/60 transition"
                    title="Inverter teto e piso caso a imagem tenha saído de cabeça para baixo"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                    Inverter Vertical (Teto ↔ Piso)
                  </button>
                  <button
                    type="button"
                    onClick={handleFlipHorizontal}
                    className="py-1.5 px-2 rounded bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-[11px] font-medium flex items-center justify-center gap-1 border border-stone-700/60 transition"
                    title="Espelhar esquerda e direita"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-stone-400" />
                    Espelhar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-stone-900/50 rounded-lg border border-dashed border-stone-700 p-4">
                <Camera className="w-8 h-8 text-stone-500 mx-auto mb-2 opacity-60" />
                <p className="text-stone-300 font-medium mb-1">Nenhum panorama capturado ainda</p>
                <p className="text-[11px] text-stone-400 mb-3">
                  Posicione a parede e o observador ou gere a captura 360° da cena agora.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate360}
                    disabled={isCapturing}
                    className="py-2 px-4 rounded bg-[#396252] hover:bg-[#2e4f42] text-white font-semibold text-xs inline-flex items-center gap-2 shadow transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                    {isCapturing ? 'Capturando 6 faces da cena...' : 'Gerar Prévia do Ambiente 360°'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs inline-flex items-center gap-1.5 border border-stone-700 transition"
                    title="Importar imagem 360 salva para visualizar e corrigir"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    Importar JPG 360
                  </button>
                </div>
              </div>
            )}

            {/* INPUT DE ARQUIVO OCULTO */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            <p className="text-[11px] text-stone-400 mt-2.5 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              Sem custo. Confira se o observador não caiu dentro de um móvel ou de uma parede.
            </p>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-stone-800 bg-stone-900/90 flex items-center justify-between gap-3 shrink-0">
          {panoramaUrl ? (
            <a
              href={panoramaUrl}
              download="Panorama_360_Equirretangular_8000x4000_8K.jpg"
              className="py-2 px-3 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-stone-700 transition"
              title="Baixar imagem panorâmica esférica equirretangular em resolução 8000x4000 (8K)"
            >
              <Download className="w-3.5 h-3.5 text-[#4ade80]" />
              Baixar .JPG (8K - 8000x4000)
            </a>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 text-xs text-stone-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!panoramaUrl}
              onClick={() => {
                if (panoramaUrl) {
                  onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, true);
                  onClose();
                }
              }}
              className="py-2 px-3 rounded bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold border border-[#4ade80]/50 shadow-xs transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
              title="Enviar o 360° para a Central Unificada (++) e fazer a leitura de materiais e objetos"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4ade80]" />
              Ler Materiais (++)
            </button>
            <button
              type="button"
              disabled={!panoramaUrl}
              onClick={() => {
                if (panoramaUrl) {
                  onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, false);
                  onClose();
                }
              }}
              className="py-2 px-3.5 rounded bg-[#396252] hover:bg-[#2e4f42] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-[#4ade80]" />
              Usar no Prompt
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DO VISUALIZADOR 360 INTERATIVO (AMPLIAR PRÉVIA) */}
      {isViewerOpen && (
        <div 
          className="fixed inset-0 z-60 bg-black/95 flex flex-col animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* BARRA SUPERIOR DO VISUALIZADOR */}
          <div className="flex items-center justify-between px-5 py-3 bg-stone-900/80 border-b border-stone-800 text-stone-200 z-10">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-sm">Visualizador 360° Interativo (VR)</span>
              <span className="text-[11px] text-stone-400">• Arraste para girar em todas as direções</span>
            </div>
            <div className="flex items-center gap-3">
              {panoramaUrl && (
                <a
                  href={panoramaUrl}
                  download="Panorama_360_Equirretangular_8000x4000_8K.jpg"
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-stone-700 transition cursor-pointer"
                  title="Baixar em resolução máxima 8000x4000 (8K)"
                >
                  <Download className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span className="hidden sm:inline">Baixar 8K (8000x4000)</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleFlipVertical}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 border border-stone-700 transition cursor-pointer"
                title="Inverter teto e chão caso esteja invertido"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                Inverter Vertical
              </button>
              <span className="text-xs text-stone-400 font-mono hidden sm:inline">
                8000 x 4000px (VR 2:1 Ultra HD 8K)
              </span>
              <button
                type="button"
                onClick={() => setIsViewerOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* PALCO WEBGL THREE.JS */}
          <div 
            ref={viewerContainerRef} 
            className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing bg-black overflow-hidden"
          />

          {/* INSTRUÇÕES E CONTROLES FLUTUANTES NO RODAPÉ DO VISUALIZADOR */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-stone-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-stone-700/60 shadow-xl text-xs text-stone-300">
            <span>🖱️ Clique e arraste para olhar ao redor</span>
            <span className="text-stone-600">•</span>
            <span>🔍 Role o scroll para dar zoom</span>
            <button
              type="button"
              onClick={() => {
                if (panoramaUrl) {
                  onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, true);
                  setIsViewerOpen(false);
                  onClose();
                }
              }}
              className="ml-2 px-3 py-1 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition text-[11px] border border-[#4ade80]/50 cursor-pointer"
            >
              🔍 Ler Materiais (++)
            </button>
            <button
              type="button"
              onClick={() => {
                if (panoramaUrl) {
                  onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, false);
                  setIsViewerOpen(false);
                  onClose();
                }
              }}
              className="px-3 py-1 rounded-full bg-[#396252] hover:bg-[#2e4f42] text-white font-bold transition text-[11px] cursor-pointer"
            >
              Usar Imagem no Render
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
