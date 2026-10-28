import { CommandSlot } from '../types';

export const COMMAND_SLOTS: CommandSlot[] = [
  {
    id: "slot_1",
    label: "A1: Otimizar Iluminação Natural (Golden Hour)",
    prompt: "A1 GERAR - Como configurar a iluminação de Golden Hour (pôr do sol suave) para uma cena externa no SketchUp, incluindo ângulo solar e temperatura de cor?",
  },
  {
    id: "slot_2",
    label: "A2: Vidros e Reflexos Ultra Realistas",
    prompt: "A2 GERAR - Quais os parâmetros ideais de Refração (IOR 1.52), Glossiness e Fresnel para vidros arquitetônicos e esquadrias de alumínio?",
  },
  {
    id: "slot_3",
    label: "A3: Câmera & Profundidade de Campo (DoF)",
    prompt: "A3 GERAR - Como calcular a distância focal (F-Number, Shutter Speed, ISO) e criar desfoque de fundo cinematográfico em detalhes de interiores?",
  },
  {
    id: "slot_4",
    label: "A4: Materiais PBR Madeiras & Porcelanatos",
    prompt: "A4 GERAR - Guia para configurar mapas PBR de madeira ripada e porcelanato polido (Diffuse, Roughness, Normal Map e Bump).",
  },
  {
    id: "slot_5",
    label: "A5: Render Noturno com Spots Quentes (3000K)",
    prompt: "A5 GERAR - Configuração passo a passo para cena noturna no SketchUp: equilíbrio entre luz ambiente externa azulada e iluminação interna quente 3000K.",
  },
  {
    id: "slot_6",
    label: "A6: Enquadramento Câmera 2 Pontos de Fuga",
    prompt: "A6 GERAR - Como alinhar perfeitamente as verticais no SketchUp (Two-Point Perspective) e posicionar a altura dos olhos a 1.55m do piso?",
  },
  {
    id: "slot_7",
    label: "A7: Concreto Aparente & Metais Escovados",
    prompt: "A7 GERAR - Como criar textura realista de concreto aparente com marcas de fôrma e metal escovado dourado/champagne?",
  },
  {
    id: "slot_8",
    label: "A8: Balanço de Branco & Exposição (EV)",
    prompt: "A8 GERAR - Como ajustar a compensação de exposição (EV) para evitar áreas estouradas próximas a janelas sem escurecer os cantos?",
  },
  {
    id: "slot_9",
    label: "A9: Grama 3D & Vegetação com Proxy",
    prompt: "A9 GERAR - Como otimizar a densidade de blocos de vegetação e grama 3D no SketchUp sem travar a viewport?",
  },
  {
    id: "slot_10",
    label: "A10: Master Prompt IA Fotorrealista",
    prompt: "A10 GERAR - Gere um Master Prompt altamente detalhado para aprimorar este render do SketchUp em IA com fotorrealismo 8K.",
  },
  {
    id: "slot_11",
    label: "B1: Sala de Estar Integrada de Luxo",
    prompt: "B1 GERAR - Checklist de iluminação indireta (fitas LED no gesso, luminárias pendentes, luz difusa em cortinas de linho).",
  },
  {
    id: "slot_12",
    label: "B2: Fachada Residencial Contemporânea",
    prompt: "B2 GERAR - Prompt e dicas de composição para fachada moderna com brises de madeira, pedra natural e espelho d'água.",
  },
  {
    id: "slot_13",
    label: "B3: Iluminação com Arquivos IES",
    prompt: "B3 GERAR - Como carregar e calibrar perfis fotométricos IES no renderizador para criar arandelas e spots com fachos realistas?",
  },
  {
    id: "slot_14",
    label: "B4: Color Mapping & Curva de Tom",
    prompt: "B4 GERAR - Quais configurações de Reinhard / ACES e clamp output ajudam a obter uma transição suave entre sombras e luzes intensas?",
  },
  {
    id: "slot_15",
    label: "B5: Denoising AI (Redução de Ruído)",
    prompt: "B5 GERAR - Melhores práticas para usar o Denoise de Inteligência Artificial sem perder nitidez nas texturas finas de tecidos e pedras.",
  },
  {
    id: "slot_16",
    label: "B6: Névoa Atmosférica / Volumetric Light",
    prompt: "B6 GERAR - Como criar raios solares volumétricos (God Rays) entrando pela janela no SketchUp?",
  },
  {
    id: "slot_17",
    label: "B7: Água de Piscina com Caustics",
    prompt: "B7 GERAR - Configuração de mapa de relevo (Noise/Water bump), transparência, refração e cáusticas na água da piscina.",
  },
  {
    id: "slot_18",
    label: "B8: Render Rápido para Aprovação do Cliente",
    prompt: "B8 GERAR - Configurações de teste rápido de iluminação (Low samples, clay mode, light cache rápido) para validar com o cliente em minutos.",
  },
  {
    id: "slot_20",
    label: "B10: Tecidos Realistas (Linho, Couro, Veludo)",
    prompt: "B10 GERAR - Como aplicar efeito Falloff/Fresnel e mapa de normais em estofados para criar o toque aveludado e micro-dobras.",
  },
  {
    id: "slot_21",
    label: "C1: Displacement (Relevo Real em Tijolinhos)",
    prompt: "C1 GERAR - Como ativar e controlar o deslocamento 3D geométrico em paredes de pedra rústica sem estourar a memória RAM.",
  },
  {
    id: "slot_22",
    label: "C2: Luz Suave de Estúdio para Detalhes",
    prompt: "C2 GERAR - Setup de luz 3 pontos (Key light, Fill light, Rim light) para destacar objetos de decoração e marcenaria de perto.",
  },
  {
    id: "slot_23",
    label: "C3: Efeito Clay / Maquete Branca",
    prompt: "C3 GERAR - Como criar o render estilo Maquete Monocromática com override de material branco e oclusão de ambiente (AO).",
  },
  {
    id: "slot_24",
    label: "C4: Configuração para Impressão em Alta (4K)",
    prompt: "C4 GERAR - Qual resolução em pixels e proporção definir para pranchas de apresentação em formato A3 e banners de alta definição?",
  },
  {
    id: "slot_25",
    label: "C5: Pós-Produção no Photoshop / Lightroom",
    prompt: "C5 GERAR - Dicas de passes de render (Render Elements: RawGI, Reflection, Cryptomatte, Depth) para finalização perfeita.",
  },
  {
    id: "slot_26",
    label: "C6: Enquadramento Vertical para Social Media",
    prompt: "C6 GERAR - Estratégia de enquadramento 4:5 e 9:16 para prender a atenção no feed do Instagram e gerar mais engajamento.",
  },
  {
    id: "slot_27",
    label: "C7: Iluminação HDRI Céu Nublado Suave",
    prompt: "C7 GERAR - Como calibrar HDRI Overcast para iluminação sem sombras duras, ideal para fotos de arquitetura em dias suaves.",
  },
  {
    id: "slot_28",
    label: "C8: Perspectiva Ampla Panorâmica 2:1",
    prompt: "C8 GERAR - Como configurar a câmera grande angular de arquitetura no SketchUp para composição ampla sem distorções esféricas nas bordas.",
  },
  {
    id: "slot_29",
    label: "C9: Master Prompt Ultra Realismo",
    prompt: "C9 GERAR - Prompt completo com termos de arquitetura premiada (ArchDaily style, Hasselblad 50mm, photorealistic raytracing, raw photo).",
  },
  {
    id: "slot_30",
    label: "C10: Diagnóstico Completo de Cena",
    prompt: "C10 GERAR - Faça uma análise completa: proporção ideal, ajuste de câmera, iluminação balanceada e materiais para render fotorrealista.",
  },
];
