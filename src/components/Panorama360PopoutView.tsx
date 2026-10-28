import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  RotateCw, 
  Download, 
  Sparkles, 
  Camera, 
  ArrowUpDown, 
  ArrowLeftRight, 
  Upload, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Check,
  Eye,
  Info,
  Maximize2
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

interface Panorama360PopoutViewProps {
  onUsePanorama?: (imageDataUrl: string, resolution: { width: number; height: number }, openMaterialsCenter?: boolean) => void;
  showToast?: (msg: string) => void;
}

export const Panorama360PopoutView: React.FC<Panorama360PopoutViewProps> = ({
  onUsePanorama,
  showToast: parentShowToast,
}) => {
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [eyeHeight, setEyeHeight] = useState<number>(1.60);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const threeStateRef = useRef<{
    camera?: THREE.PerspectiveCamera;
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    mesh?: THREE.Mesh;
    texture?: THREE.Texture;
  }>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (parentShowToast) parentShowToast(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 3500);
  };

  // 1. Carregamento inicial da imagem de várias fontes:
  // - localStorage
  // - window.carregarPanorama360Externo
  // - Solicitação ao SketchUp Ruby via callback
  useEffect(() => {
    // Carrega do storage se houver
    try {
      const saved = safeStorage.getItem('skp_panorama360_active');
      if (saved && saved.startsWith('data:image')) {
        setPanoramaUrl(saved);
      }
    } catch (_) {}

    // Registra função global para o Ruby injetar diretamente
    (window as any).carregarPanorama360Externo = (dataUrl: string) => {
      if (dataUrl && typeof dataUrl === 'string') {
        setPanoramaUrl(dataUrl);
        showToast('✓ Panorama 360° carregado!');
      }
    };

    // Solicita ao SketchUp a última imagem se estiver no HtmlDialog
    if ((window as any).sketchup?.solicitar_imagem_360_inicial) {
      try {
        (window as any).sketchup.solicitar_imagem_360_inicial();
      } catch (_) {}
    }

    // Escuta canal broadcast entre abas / janelas
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('skp_panorama360_channel');
        bc.onmessage = (ev) => {
          if (ev.data?.action === 'set_panorama' && ev.data.dataUrl) {
            setPanoramaUrl(ev.data.dataUrl);
            showToast('✓ Novo panorama 360° sincronizado!');
          }
        };
      }
    } catch (_) {}

    // Escuta evento do SketchUp se as 6 faces forem capturadas
    const handleCubemapReady = async (e: any) => {
      try {
        const faces: CubemapFaces = e.detail?.faces;
        if (faces && faces.front && faces.right) {
          showToast('Costurando 6 faces em Panorama 360° Ultra HD 8K (8000x4000)...');
          const equirectUrl = await stitchCubemapToEquirectangular(faces, 8000, 4000);
          setPanoramaUrl(equirectUrl);
          setIsCapturing(false);
          try {
            safeStorage.setItem('skp_panorama360_active', equirectUrl);
          } catch (_) {}
          showToast('✓ Panorama 360° gerado com sucesso em 8000x4000!');
        }
      } catch (err) {
        console.error('Erro ao costurar cubemap 360:', err);
        setIsCapturing(false);
        showToast('Erro ao processar faces 360°.');
      }
    };

    window.addEventListener('skp-360-cubemap-ready', handleCubemapReady);

    return () => {
      window.removeEventListener('skp-360-cubemap-ready', handleCubemapReady);
      if (bc) bc.close();
      delete (window as any).carregarPanorama360Externo;
    };
  }, []);

  // 2. Inicialização do Three.js Viewer
  useEffect(() => {
    if (!viewerContainerRef.current || !panoramaUrl) return;

    const container = viewerContainerRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || (window.innerHeight - 60);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.replaceChildren(renderer.domElement);

    // Esfera invertida com coordenadas de textura equirretangulares
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);

    const loader = new THREE.TextureLoader();
    let mesh: THREE.Mesh | null = null;

    loader.load(
      panoramaUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        const material = new THREE.MeshBasicMaterial({ map: texture });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        threeStateRef.current = { camera, scene, renderer, mesh, texture };
      },
      undefined,
      (err) => {
        console.error('Falha ao carregar textura 360:', err);
      }
    );

    // Controles de mouse / toque
    let isUserInteracting = false;
    let onPointerDownPointerX = 0;
    let onPointerDownPointerY = 0;
    let onPointerDownLon = 180;
    let onPointerDownLat = 0;
    let lon = 180;
    let lat = 0;
    let phi = 0;
    let theta = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      isUserInteracting = true;
      onPointerDownPointerX = event.clientX;
      onPointerDownPointerY = event.clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;
      container.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.isPrimary === false || !isUserInteracting) return;
      lon = (onPointerDownPointerX - event.clientX) * 0.18 + onPointerDownLon;
      lat = (event.clientY - onPointerDownPointerY) * 0.18 + onPointerDownLat;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.isPrimary === false) return;
      isUserInteracting = false;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSpeed = 0.05;
      camera.fov = Math.max(30, Math.min(100, camera.fov + event.deltaY * zoomSpeed));
      camera.updateProjectionMatrix();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // ResizeObserver para manter aspect ratio quando o usuário redimensiona a janela do SketchUp
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      if (newWidth > 0 && newHeight > 0) {
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }
    });
    resizeObserver.observe(container);

    let isDisposed = false;
    const animate = () => {
      if (isDisposed) return;
      animationFrameRef.current = requestAnimationFrame(animate);

      if (isAutoRotating && !isUserInteracting) {
        lon += 0.15;
      }

      lat = Math.max(-85, Math.min(85, lat));
      phi = THREE.MathUtils.degToRad(90 - lat);
      theta = THREE.MathUtils.degToRad(lon);

      const targetX = 500 * Math.sin(phi) * Math.cos(theta);
      const targetY = 500 * Math.cos(phi);
      const targetZ = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(targetX, targetY, targetZ);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      isDisposed = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('wheel', onWheel);

      renderer.dispose();
      geometry.dispose();
      if (mesh && (mesh.material as any)?.dispose) {
        (mesh.material as any).dispose();
      }
    };
  }, [panoramaUrl, isAutoRotating]);

  // Ações de manipulação de imagem
  const handleFlipVertical = async () => {
    if (!panoramaUrl) return;
    try {
      showToast('Invertendo verticalmente (Teto ↔ Piso)...');
      const fixed = await flipImageVertically(panoramaUrl);
      setPanoramaUrl(fixed);
      try {
        safeStorage.setItem('skp_panorama360_active', fixed);
      } catch (_) {}
      showToast('✓ Imagem invertida com sucesso!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao inverter imagem.');
    }
  };

  const handleFlipHorizontal = async () => {
    if (!panoramaUrl) return;
    try {
      showToast('Espelhando imagem horizontalmente...');
      const fixed = await flipImageHorizontally(panoramaUrl);
      setPanoramaUrl(fixed);
      try {
        safeStorage.setItem('skp_panorama360_active', fixed);
      } catch (_) {}
      showToast('✓ Imagem espelhada horizontalmente!');
    } catch (err) {
      console.error(err);
      showToast('Erro ao espelhar imagem.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPanoramaUrl(reader.result);
        try {
          safeStorage.setItem('skp_panorama360_active', reader.result);
        } catch (_) {}
        showToast('✓ Imagem 360° importada com sucesso!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRecaptureSketchup = () => {
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

    // Fallback de teste se fora do SketchUp
    setTimeout(async () => {
      const synthetic = await generateSynthetic360Panorama();
      setPanoramaUrl(synthetic);
      setIsCapturing(false);
      showToast('✓ Panorama 360° de demonstração gerado!');
    }, 700);
  };

  const handleZoom = (delta: number) => {
    const cam = threeStateRef.current.camera;
    if (cam) {
      cam.fov = Math.max(30, Math.min(100, cam.fov + delta));
      cam.updateProjectionMatrix();
    }
  };

  const handleResetCamera = () => {
    const cam = threeStateRef.current.camera;
    if (cam) {
      cam.fov = 75;
      cam.updateProjectionMatrix();
      showToast('Câmera centralizada.');
    }
  };

  const handleApplyToPlugin = (openMaterialsCenter: boolean = false) => {
    if (!panoramaUrl) return;

    // 1. Notifica via callback Ruby
    if ((window as any).sketchup?.aplicar_panorama_no_plugin) {
      try {
        (window as any).sketchup.aplicar_panorama_no_plugin(panoramaUrl);
      } catch (_) {}
    }

    // 2. Notifica via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('skp_panorama360_channel');
        bc.postMessage({
          action: 'use_panorama',
          dataUrl: panoramaUrl,
          resolution: { width: 8000, height: 4000 },
          openMaterials: openMaterialsCenter,
        });
        bc.close();
      }
    } catch (_) {}

    // 3. Salva no safeStorage
    try {
      safeStorage.setItem('skp_panorama360_selected', panoramaUrl);
    } catch (_) {}

    // 4. Executa handler de prop se fornecido
    if (onUsePanorama) {
      onUsePanorama(panoramaUrl, { width: 8000, height: 4000 }, openMaterialsCenter);
    }

    showToast(
      openMaterialsCenter
        ? '✓ Panorama 360° enviado para a Central Unificada de Leitura de Materiais (++)!'
        : '✓ Panorama 360° anexado à caixa de prompt e à Central de Leitura (++)!'
    );
  };

  return (
    <div className="w-screen h-screen bg-[#0a0f0d] text-stone-100 flex flex-col select-none overflow-hidden font-sans">
      {/* BARRA SUPERIOR DEDICADA */}
      <header className="h-14 bg-[#14221b] border-b border-[#234233] px-4 flex items-center justify-between gap-2 shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#285743] border border-[#4ade80]/40 flex items-center justify-center shrink-0 shadow-xs">
            <Compass className="w-5 h-5 text-[#4ade80]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide text-white whitespace-nowrap">
                PRÉVIA 360° VR
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#1e4233] text-[#4ade80] border border-[#4ade80]/30 whitespace-nowrap">
                8000 x 4000 (8K)
              </span>
            </div>
            <p className="text-[11px] text-stone-400 truncate">
              Visualização imersiva 360° sem precisar esticar a tela do plugin
            </p>
          </div>
        </div>

        {/* FERRAMENTAS DE AJUSTE RÁPIDO */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleFlipVertical}
            disabled={!panoramaUrl}
            className="px-2.5 py-1.5 rounded bg-[#1b3327] hover:bg-[#254737] disabled:opacity-40 text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-[#34664e] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Inverter teto e chão caso tenha saído de cabeça para baixo"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#4ade80]" />
            <span className="hidden md:inline">Inverter Vertical</span>
            <span className="md:hidden">Inverter</span>
          </button>

          <button
            type="button"
            onClick={handleFlipHorizontal}
            disabled={!panoramaUrl}
            className="px-2.5 py-1.5 rounded bg-[#1b3327] hover:bg-[#254737] disabled:opacity-40 text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-[#34664e] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Espelhar esquerda e direita"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-stone-300" />
            <span className="hidden md:inline">Espelhar</span>
          </button>

          <button
            type="button"
            onClick={handleRecaptureSketchup}
            disabled={isCapturing}
            className="px-2.5 py-1.5 rounded bg-[#1b3327] hover:bg-[#254737] disabled:opacity-40 text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-[#34664e] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Recapturar as 6 faces da cena no SketchUp"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#4ade80] ${isCapturing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recapturar Cena</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded bg-[#1b3327] hover:bg-[#254737] text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-[#34664e] transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Importar imagem JPG 360 salva para visualizar e corrigir"
          >
            <Upload className="w-3.5 h-3.5 text-[#4ade80]" />
            <span className="hidden lg:inline">Importar 360</span>
          </button>

          {panoramaUrl && (
            <a
              href={panoramaUrl}
              download="Panorama_360_Equirretangular_8000x4000.jpg"
              className="px-2.5 py-1.5 rounded bg-[#1b3327] hover:bg-[#254737] text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-[#34664e] transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Baixar imagem JPG 8000x4000 (Ultra HD 8K) no computador"
            >
              <Download className="w-3.5 h-3.5 text-stone-300" />
              <span className="hidden sm:inline">Baixar JPG (8K)</span>
            </a>
          )}

          <button
            type="button"
            disabled={!panoramaUrl}
            onClick={() => handleApplyToPlugin(true)}
            className="px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-md border border-[#4ade80]/50 transition active:scale-95 cursor-pointer whitespace-nowrap ml-1"
            title="Enviar este panorama 360° para a Central Unificada (++) e fazer a leitura de materiais e objetos"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>Ler Materiais (++)</span>
          </button>

          <button
            type="button"
            disabled={!panoramaUrl}
            onClick={() => handleApplyToPlugin(false)}
            className="px-3.5 py-1.5 rounded bg-gradient-to-r from-[#285743] to-[#396252] hover:from-[#34664e] hover:to-[#467a65] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-md border border-[#4ade80]/50 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Enviar este panorama 360° para a caixa de envio do plugin"
          >
            <Check className="w-3.5 h-3.5 text-[#4ade80]" />
            <span>Usar no Render (8K)</span>
          </button>
        </div>
      </header>

      {/* ÁREA PRINCIPAL: VISUALIZADOR 360 WEBGL */}
      <main className="flex-1 w-full h-full relative bg-black overflow-hidden">
        {panoramaUrl ? (
          <div
            ref={viewerContainerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing relative"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#0d1411]">
            <div className="w-16 h-16 rounded-full bg-[#1b3327] border border-[#2d5743] flex items-center justify-center mb-4 text-[#4ade80]">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Nenhum Panorama 360° Carregado</h2>
            <p className="text-xs text-stone-400 max-w-md mb-6 leading-relaxed">
              Você pode capturar automaticamente as 6 faces do modelo 3D atual no SketchUp ou carregar uma imagem panorâmica equirretangular (2:1).
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRecaptureSketchup}
                disabled={isCapturing}
                className="px-4 py-2 rounded-lg bg-[#285743] hover:bg-[#34664e] text-white font-bold text-xs flex items-center gap-2 shadow-lg border border-[#4ade80]/40 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 text-[#4ade80] ${isCapturing ? 'animate-spin' : ''}`} />
                {isCapturing ? 'Capturando 6 faces do SketchUp...' : 'Capturar Cena 360° no SketchUp'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-[#1b3327] hover:bg-[#254737] text-stone-200 font-semibold text-xs flex items-center gap-2 border border-[#34664e] transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#4ade80]" />
                Importar Arquivo JPG 360
              </button>
            </div>
          </div>
        )}

        {/* CONTROLES FLUTUANTES LATERAIS (ZOOM & ROTAÇÃO) */}
        {panoramaUrl && (
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 bg-[#14221b]/90 backdrop-blur-md p-1.5 rounded-lg border border-[#234233] shadow-lg">
            <button
              type="button"
              onClick={() => handleZoom(-10)}
              className="p-2 text-stone-300 hover:text-white hover:bg-[#285743] rounded transition"
              title="Aproximar zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(10)}
              className="p-2 text-stone-300 hover:text-white hover:bg-[#285743] rounded transition"
              title="Afastar zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetCamera}
              className="p-2 text-stone-300 hover:text-white hover:bg-[#285743] rounded transition"
              title="Centralizar Câmera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-2 rounded transition ${isAutoRotating ? 'bg-[#285743] text-[#4ade80]' : 'text-stone-300 hover:text-white hover:bg-[#1e4233]'}`}
              title={isAutoRotating ? "Pausar rotação automática" : "Iniciar rotação 360° contínua"}
            >
              <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* BARRA FLUTUANTE DE ORIENTAÇÃO NO RODAPÉ */}
        {panoramaUrl && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-[#14221b]/90 backdrop-blur-md px-5 py-2.5 rounded-full border border-[#285743] shadow-2xl text-xs text-stone-300 max-w-[95%]">
            <div className="flex items-center gap-1.5 text-stone-200">
              <span className="text-emerald-400">🖱️</span>
              <span>Arraste para girar em 360°</span>
            </div>
            <span className="text-stone-600 hidden sm:inline">•</span>
            <div className="hidden sm:flex items-center gap-1.5 text-stone-300">
              <span className="text-emerald-400">🔍</span>
              <span>Scroll para Zoom</span>
            </div>
            <span className="text-stone-600 hidden md:inline">•</span>
            <span className="text-[11px] text-stone-400 font-mono hidden md:inline">
              8000 x 4000px (VR 2:1 Ultra HD 8K)
            </span>
            <button
              type="button"
              onClick={() => handleApplyToPlugin(true)}
              className="ml-2 px-3.5 py-1 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11.5px] border border-[#4ade80]/50 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              🔍 Ler Materiais (++)
            </button>
            <button
              type="button"
              onClick={() => handleApplyToPlugin(false)}
              className="px-3.5 py-1 rounded-full bg-[#285743] hover:bg-[#34664e] text-white font-bold text-[11.5px] border border-[#4ade80]/40 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              ✓ Usar no Prompt do Plugin
            </button>
          </div>
        )}

        {/* TOAST DE FEEDBACK FLUTUANTE */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#1e4233] border border-[#4ade80]/50 text-[#4ade80] px-4 py-2 rounded-lg text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <span>{toastMsg}</span>
          </div>
        )}
      </main>

      {/* INPUT OCULTO PARA IMPORTAÇÃO DE ARQUIVO */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />
    </div>
  );
};
