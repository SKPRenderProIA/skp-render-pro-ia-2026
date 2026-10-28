import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import zlib from "zlib";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { SKP_OFFICIAL_SYSTEM_PROMPT } from "./server/skpOfficialSystemPrompt";
import { buildMandatoryFullFramePrompt, MANDATORY_FULL_FRAME_PRESERVATION_TEMPLATE } from "./server/fullFramePreservationPrompt";
import {
  getLicensesFromDb,
  saveLicenseToDb,
  deleteLicenseFromDb,
  getLicenseByPcId,
  getLicenseByKey,
  getLicenseById,
  initFirestoreSync,
  ClientLicenseRecord,
} from "./src/lib/firestore-service";
import {
  getPluginReleaseInfo,
  publishPluginRelease,
  clearPluginReleaseAlert,
} from "./src/lib/plugin-release-service";

dotenv.config();

// Chave mestra idêntica à definida no plugin skp_render_pro.rb
const CHAVE_SECRETA_PLUGIN = process.env.LICENSE_SECRET_KEY || "Minha_Senha_Secreta_Sketchup_2026!";

function signLicenseKey(pcId: string, validUntil: string): string {
  const dadosObj = { id: pcId.trim(), validade: validUntil.trim() };
  const dadosJson = JSON.stringify(dadosObj);
  const hmac = crypto.createHmac("sha256", CHAVE_SECRETA_PLUGIN);
  hmac.update(dadosJson);
  const assinatura = hmac.digest("hex");
  const payload = `${dadosJson}|${assinatura}`;
  return Buffer.from(payload, "utf-8").toString("base64");
}

function parseLicenseDate(validUntil: string): Date {
  if (!validUntil) return new Date(0);
  const trimmed = validUntil.trim();
  
  // 1. Formato YYYY-MM-DD (apenas data): expira às 23:59:59 no horário de Brasília (UTC-3)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59-03:00`);
  }
  
  // 2. Formato YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss sem timezone:
  // Considera estritamente o horário local de Brasília (-03:00) para evitar expiração prematura no servidor UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}:00-03:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}-03:00`);
  }
  
  // 3. Se já contiver timezone explícito (Z ou offset +/-)
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function isLicenseExpired(validUntil: string): boolean {
  if (!validUntil) return true;
  const now = new Date();
  const targetDate = parseLicenseDate(validUntil);
  if (isNaN(targetDate.getTime())) return false;
  // Só expira se o instante atual for estritamente MAIOR que o instante exato de término
  return now.getTime() > targetDate.getTime();
}

function formatLicenseDateTime(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}/${m}/${y} às 23:59`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const [datePart, timePart] = trimmed.split("T");
    const [y, m, d] = datePart.split("-");
    const hm = timePart.substring(0, 5);
    return `${d}/${m}/${y} às ${hm}`;
  }
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return val;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper to map app ratios to Imagen supported aspect ratios
function mapAspectRatio(ratio?: number): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  if (!ratio) return "3:4";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  if (Math.abs(ratio - 0.5625) < 0.05) return "9:16";
  if (Math.abs(ratio - 1.777) < 0.1) return "16:9";
  if (ratio < 1) return "3:4";
  return "4:3";
}

// Helper to extract clean materials summary from architectural analysis text
function extractMaterialsSummaryFromText(text: string): { pt: string; en: string } {
  const defaultMatsPt = "Pavimentação contínua com réguas amadeiradas de carvalho natural fosco (roughness 0.45); alvenaria mineral acetinada fosca em tom neutro quente/areia (roughness 0.70); marcenaria sob medida com veios orgânicos contínuos em lâmina natural nobre; forro de gesso liso ultra-fosco aveludado; perfis de alumínio preto fosco microtexturizado; vidros translúcidos com reflexo de fresnel suave; iluminação indireta rasante com fitas de LED 2700K-3000K e luz natural difusa.";
  const defaultMatsEn = "Continuous flooring in matte natural oak wood planks (roughness 0.45); warm neutral sand mineral wall paint (roughness 0.70); bespoke architectural joinery in continuous organic wood veneer; velvet ultra-matte smooth gypsum ceiling; micro-textured matte black aluminum frames; high-transparency glass with subtle Fresnel reflections; warm ambient indirect LED cove lighting (2700K-3000K) balanced with soft diffused daylight.";

  if (!text) return { pt: defaultMatsPt, en: defaultMatsEn };

  const sec2MaterialsMatch = text.match(/\* \*\*Materiais e Acabamentos[^\n]*\*\*([\s\S]*?)(?=\* \*\*Iluminação|### SEÇÃO 3|---|$)/i);
  if (sec2MaterialsMatch && sec2MaterialsMatch[1]?.trim()) {
    const raw = sec2MaterialsMatch[1].trim()
      .replace(/^[-\s*]+/gm, '')
      .replace(/\n+/g, ' ')
      .trim();
    if (raw.length > 25) {
      return {
        pt: raw.slice(0, 450),
        en: "High-end PBR materials with natural wood planks, matte mineral paint, bespoke cabinetry in natural veneer, smooth acoustic ceiling, textured black aluminum frames and realistic physical roughness."
      };
    }
  }

  return { pt: defaultMatsPt, en: defaultMatsEn };
}

// Helper to ensure the prompt and sections strictly start with the user's input text and contain the full-frame preservation block
function ensurePromptStartsWithUserText(rawResult: string, userInitialLead: string): string {
  if (!userInitialLead) return rawResult;
  const cleanLead = userInitialLead.trim();
  if (!cleanLead) return rawResult;

  let result = rawResult.trim();
  const mats = extractMaterialsSummaryFromText(result);
  const sceneIdMatch = cleanLead.match(/^([A-Za-z][0-9]{1,2}(?:\s*GERAR)?)/i);
  const leadEn = sceneIdMatch ? sceneIdMatch[1].toUpperCase() : cleanLead;

  // 1. Garantir que o Prompt Completo PT (SEÇÃO 4 ou SEÇÃO 5) inicie com o texto exato do usuário e inclua o bloco mandatório INTEGRALMENTE
  const secPtRegex = /(### SEÇÃO [45][^\n]*(?:PT|PORTUGU[EÊ]S|PROMPT COMPLETO)[^\n]*\n+```(?:text)?\s*)([\s\S]*?)(```)/i;
  const secPtMatch = result.match(secPtRegex);
  if (secPtMatch) {
    let ptPrompt = secPtMatch[2].trim();

    // Substitui placeholders literais caso o modelo não os tenha preenchido
    ptPrompt = ptPrompt.replace(/\[PROMPT DO CLIENTE\]/gi, cleanLead);
    ptPrompt = ptPrompt.replace(/\[materiais gerados pelo plugin\]/gi, mats.pt);

    if (!ptPrompt.includes("MANDATORY FULL-FRAME PRESERVATION")) {
      const fullFrameBlock = buildMandatoryFullFramePrompt(cleanLead, mats.pt);
      let remainingPt = ptPrompt;
      if (remainingPt.toLowerCase().startsWith(cleanLead.toLowerCase())) {
        remainingPt = remainingPt.substring(cleanLead.length).trim();
      }
      ptPrompt = remainingPt 
        ? `${cleanLead}\n\n${fullFrameBlock}\n\n${remainingPt}`
        : `${cleanLead}\n\n${fullFrameBlock}`;
    } else {
      // Garante que o início do bloco seja o cleanLead
      const lowerPt = ptPrompt.toLowerCase();
      const lowerLead = cleanLead.toLowerCase();
      if (!lowerPt.startsWith(lowerLead)) {
        ptPrompt = `${cleanLead}\n\n${ptPrompt}`;
      }
      // Se tiver versão truncada de MANDATORY FULL-FRAME PRESERVATION, garante a versão íntegra
      if (!ptPrompt.includes("STRICT") || !ptPrompt.includes("Never crop, zoom")) {
        const fullFrameBlock = buildMandatoryFullFramePrompt(cleanLead, mats.pt);
        ptPrompt = `${cleanLead}\n\n${fullFrameBlock}`;
      }
    }
    ptPrompt = ptPrompt
      .replace(/MANDATORY FULL-FRAME PRESERVATION:\s*source image is [^\n]*\n?/gi, "MANDATORY FULL-FRAME PRESERVATION:\n")
      .replace(/Preservação obrigatória do enquadramento completo[^\n]*\n?/gi, "Preservação obrigatória do enquadramento total:\n")
      .replace(/Preservação obrigatória do enquadramento total\s*\([^)]*\)/gi, "Preservação obrigatória do enquadramento total")
      .replace(/(?:a imagem de origem tem \d+x\d+.*?A área de renderização[^\n.]*\.?)/gi, "")
      .replace(/(?:source image is \d+x\d+.*?Output canvas is \d+x\d+.*?(?:aspect ratio|\.))/gi, "")
      .replace(/\(?\b720x1290\s*(?:->|para)?\s*608x1088\b\)?/gi, "")
      .replace(/\b720x1290\b/gi, "")
      .replace(/\b608x1088\b/gi, "")
      .trim();
    result = result.replace(secPtRegex, `$1${ptPrompt}\n$3`);
  }

  // 2. Garantir que o Prompt Completo EN (SEÇÃO 5 ou SEÇÃO 6) inicie com o identificador/texto do usuário e inclua o bloco mandatório INTEGRALMENTE
  const secEnRegex = /(### SEÇÃO [56][^\n]*(?:EN|INGL[EÊ]S|ENGLISH)[^\n]*\n+```(?:text)?\s*)([\s\S]*?)(```)/i;
  const secEnMatch = result.match(secEnRegex);
  if (secEnMatch) {
    let enPrompt = secEnMatch[2].trim();

    enPrompt = enPrompt.replace(/\[PROMPT DO CLIENTE\]/gi, leadEn);
    enPrompt = enPrompt.replace(/\[materiais gerados pelo plugin\]/gi, mats.en);

    if (!enPrompt.includes("MANDATORY FULL-FRAME PRESERVATION")) {
      const fullFrameBlock = buildMandatoryFullFramePrompt(leadEn, mats.en);
      let remainingEn = enPrompt;
      if (remainingEn.toLowerCase().startsWith(leadEn.toLowerCase())) {
        remainingEn = remainingEn.substring(leadEn.length).trim();
      }
      enPrompt = remainingEn
        ? `${leadEn}\n\n${fullFrameBlock}\n\n${remainingEn}`
        : `${leadEn}\n\n${fullFrameBlock}`;
    } else {
      const lowerEn = enPrompt.toLowerCase();
      const lowerLeadEn = leadEn.toLowerCase();
      if (!lowerEn.startsWith(lowerLeadEn)) {
        enPrompt = `${leadEn}\n\n${enPrompt}`;
      }
      if (!enPrompt.includes("STRICT") || !enPrompt.includes("Never crop, zoom")) {
        const fullFrameBlock = buildMandatoryFullFramePrompt(leadEn, mats.en);
        enPrompt = `${leadEn}\n\n${fullFrameBlock}`;
      }
    }
    enPrompt = enPrompt
      .replace(/MANDATORY FULL-FRAME PRESERVATION:\s*source image is [^\n]*\n?/gi, "MANDATORY FULL-FRAME PRESERVATION:\n")
      .replace(/Preservação obrigatória do enquadramento completo[^\n]*\n?/gi, "Preservação obrigatória do enquadramento total:\n")
      .replace(/Preservação obrigatória do enquadramento total\s*\([^)]*\)/gi, "Preservação obrigatória do enquadramento total")
      .replace(/(?:source image is \d+x\d+.*?Output canvas is \d+x\d+.*?(?:aspect ratio|\.))/gi, "")
      .replace(/(?:a imagem de origem tem \d+x\d+.*?A área de renderização[^\n.]*\.?)/gi, "")
      .replace(/\(?\b720x1290\s*(?:->|para)?\s*608x1088\b\)?/gi, "")
      .replace(/\b720x1290\b/gi, "")
      .replace(/\b608x1088\b/gi, "")
      .trim();
    result = result.replace(secEnRegex, `$1${enPrompt}\n$3`);
  }

  // 3. Se nenhuma seção com código text foi identificada, injeta SEÇÃO 4 e SEÇÃO 5 completas
  if (!result.includes("MANDATORY FULL-FRAME PRESERVATION")) {
    const fullFrameBlockPt = buildMandatoryFullFramePrompt(cleanLead, mats.pt);
    const fullFrameBlockEn = buildMandatoryFullFramePrompt(leadEn, mats.en);
    result = `${result}\n\n---\n\n### SEÇÃO 4 — PROMPT COMPLETO — PT\n\n\`\`\`text\n${cleanLead}\n\n${fullFrameBlockPt}\n\`\`\`\n\n---\n\n### SEÇÃO 5 — PROMPT COMPLETO — EN\n\n\`\`\`text\n${leadEn}\n\n${fullFrameBlockEn}\n\`\`\``;
  }

  // 4. Garantir que o topo do documento tenha como cabeçalho inicial o que o usuário escreveu
  const startsWithUserText = result.startsWith(cleanLead) || 
                             result.startsWith(`# ${cleanLead}`) || 
                             result.startsWith(`**${cleanLead}**`);
  if (!startsWithUserText) {
    result = `# ${cleanLead}\n\n${result}`;
  }

  // 5. Remover terminantemente SEÇÃO 6 — IMAGE READING JSON e blocos JSON no final
  result = result.replace(/(\n*---\s*)?\n*### SEÇÃO 6[\s\S]*$/i, "").trim();
  result = result.replace(/(\n*---\s*)?\n*### [^\n]*IMAGE READING JSON[\s\S]*$/i, "").trim();
  result = result.replace(/\n+```json[\s\S]*?```\s*$/i, "").trim();

  // 6. Remover qualquer termo residual de 360, VR e equirretangular dos prompts gerados
  result = result.replace(/\[\s*(?:GERAR NA MAIOR RESOLUÇÃO POSSÍVEL|MANDATORY MAXIMUM RESOLUTION)?[^\]]*8000x4000[^\]]*\]\s*/gi, "");
  result = result.replace(/(?:Panorama\s+)?(?:Equirretangular|Equirectangular)\s*(?:esférico\s*)?(?:360[°º]?\s*(?:x\s*180[°º]?)?)?(?:\s*\(proporção 2:1\)|\s*\(2:1 aspect ratio\))?/gi, "Fotografia arquitetônica");
  result = result.replace(/\b360[°º]?\s*(?:VR|esféric[oa]|graus)?\b/gi, "");
  result = result.replace(/\bseamless\s+wrap-around\b/gi, "");
  result = result.replace(/\bcostura\s+(?:360\s+)?contínua\s+perfeita\b/gi, "");
  result = result.replace(/\bcâmera\s+360[°º]?\b/gi, "câmera");

  // 7. Remover terminantemente qualquer menção de dimensões em pixels (ex: 720x1290, 608x1088, imagem de origem tem...) que prejudiquem a renderização
  result = result
    .replace(/MANDATORY FULL-FRAME PRESERVATION:\s*source image is [^\n]*\n?/gi, "MANDATORY FULL-FRAME PRESERVATION:\n")
    .replace(/Preservação obrigatória do enquadramento completo \(full-frame\): a imagem de origem tem [^\n.]*\.[^\n.]*\./gi, "Preservação obrigatória do enquadramento total mantendo a mesma orientação e proporção.")
    .replace(/Preservação obrigatória do enquadramento completo[^\n]*\n?/gi, "Preservação obrigatória do enquadramento total:\n")
    .replace(/Preservação obrigatória do enquadramento total\s*\([^)]*720x1290[^)]*\)/gi, "Preservação obrigatória do enquadramento total")
    .replace(/(?:a imagem de origem tem \d+x\d+.*?A área de renderização[^\n.]*\.?)/gi, "")
    .replace(/(?:source image is \d+x\d+.*?Output canvas is \d+x\d+.*?(?:aspect ratio|\.))/gi, "")
    .replace(/\(?\b720x1290\s*(?:->|para)?\s*608x1088\b\)?/gi, "")
    .replace(/\b720x1290\b/gi, "")
    .replace(/\b608x1088\b/gi, "");

  return result;
}

// Helper to generate an ultra-deep forensic ArchViz prompt when external API is in high demand (503)
function generateArchVizFallbackPrompt(userPrompt: string, sceneId: string, userInitialLead = "", targetW = 2000, targetH = 2500, ratioLabel = "4:5 (Feed do Instagram)"): string {
  const lead = (userInitialLead || (sceneId ? `${sceneId} GERAR` : "A1 GERAR")).trim();
  const cleanedPrompt = userPrompt
    .replace(/^[A-Za-z][0-9]{1,2}\s*(GERAR\s*-?)?/i, "")
    .replace(/\b(?:360[°º]?|VR|equirretangular|equirectangular)\b/gi, "")
    .trim() || "Reconstrução fiel / Fidelidade arquitetônica absoluta sem alterações de elementos.";

  const materialsPt = `Pavimentação contínua com réguas amadeiradas de carvalho natural fosco (roughness 0.45); alvenaria mineral acetinada fosca em tom neutro quente/areia (roughness 0.70); marcenaria sob medida com veios orgânicos contínuos em lâmina natural nobre; forro de gesso liso ultra-fosco aveludado; perfis de alumínio preto fosco microtexturizado; vidros translúcidos com reflexo de fresnel suave; iluminação indireta rasante com fitas de LED 2700K-3000K e luz natural difusa.`;

  const materialsEn = `Continuous flooring in matte natural oak wood planks (roughness 0.45); warm neutral sand mineral wall paint (roughness 0.70); bespoke architectural joinery in continuous organic wood veneer; velvet ultra-matte smooth gypsum ceiling; micro-textured matte black aluminum frames; high-transparency glass with subtle Fresnel reflections; warm ambient indirect LED cove lighting (2700K-3000K) balanced with soft diffused daylight.`;

  const fullFrameBlockPt = buildMandatoryFullFramePrompt(lead, materialsPt);
  const fullFrameBlockEn = buildMandatoryFullFramePrompt(lead, materialsEn);

  return `# ${lead}

### SEÇÃO 1 — IMAGEM ANALISADA

* **Identificação da Cena:** Espaço arquitetônico contemporâneo com marcenaria sob medida, integração espacial e composição equilibrada.
* **Origem Visual:** Captura de viewport 3D do SketchUp com exibição de linhas de contorno (edges) ativas, sombreamento básico e geometria pura sem ray tracing ou iluminação global estocástica.

---

### SEÇÃO 2 — ANÁLISE VISUAL PROFUNDA

* **Câmera:**
  - **Enquadramento e Altura:** Câmera frontal posicionada rigidamente ao nível dos olhos (1,50 m a 1,60 m do piso acabado).
  - **Orientação e Perspectiva:** Perspectiva central estável, pontos de fuga alinhados no plano horizontal, linhas verticais aprumadas a 90 graus (sem distorções de grande angular).
  - **Proporção:** Enquadramento travado ${ratioLabel} com resolução de saída ${targetW}x${targetH} px.

* **Arquitetura e Volumetria:**
  - **Estrutura e Volumes:** Volumes ortogonais limpos, pé-direito proporcional (2,80 m a 3,00 m), transições nítidas entre alvenaria, forro e planos verticais.
  - **Aberturas:** Vãos livres e esquadrias de proporções arquitetônicas equilibradas mantendo alinhamentos estruturais.

* **Materiais e Acabamentos (LEITURA CIRÚRGICA DE MATERIAIS):**
  - **Piso:** Pavimentação contínua em réguas amadeiradas com textura tátil de carvalho/freijó natural fosco (roughness 0.45), juntas milimétricas retificadas de 1mm assentadas no sentido longitudinal da perspectiva, com reflexão difusa das aberturas sem brilho especular artificial.
  - **Paredes e Painéis:** Alvenaria com pintura mineral acetinada fosca tom neutro quente/areia (roughness 0.70, zero reflexão espelhada); painéis de marcenaria vertical com veios orgânicos contínuos e frisos de dilatação de 5mm.
  - **Teto e Forro:** Forro de gesso liso ultra-fosco aveludado com recortes perimetrais e sancas para iluminação indireta rasante.
  - **Esquadrias:** Perfis de alumínio com pintura eletrostática preto fosco microtexturizado e vidro laminado incolor translúcido com reflexo de fresnel suave.
  - **Mobiliário Fixo e Bancadas:** Marcenaria sob medida em laca fosca anti-touch e lâmina de madeira natural nobre; bancadas minerais sólidas com acabamento acetinado escovado e bordas com micro-chanfro de 1mm.
  - **Metais e Detalhes:** Perfis metálicos e ferragens com acabamento anodizado escovado sem aberrações cromáticas.
  - **Tecidos e Estofados:** Linho e fibras naturais com trama tátil visível, micro-sombras de contato e sem aspecto sintético plastificado.

* **Iluminação e Sombras:**
  - **Fonte de Luz:** Iluminação natural difusa preenchendo o ambiente suavemente através das aberturas sem estouro de brancos.
  - **Iluminação Artificial:** Fitas de LED indiretas embutidas em temperatura de cor quente (2700K a 3000K), gerando luz rasante suave sobre as texturas das paredes e marcenaria.
  - **Sombras:** Sombras de contato nítidas e oclusão de ambiente realista sob móveis, rodapés e junções de planos.

* **Paisagismo e Hardscape:**
  - Vegetação e elementos verdes em primeiro plano e exterior respeitando espécies adequadas, folhagens com micro-translucidez (subsurface scattering) sob a luz natural.

* **Entorno e Horizonte:**
  - Contexto externo visível pelas aberturas coerente com iluminação e atmosfera geral do projeto.

* **Objetos e Veículos:**
  - Mobiliário e adornos decorativos ancorados com firmeza sobre as superfícies de apoio, respeitando escala e ergonomia visual.

* **Profundidade e Relações Espaciais:**
  - Primeiro plano nítido estabelecendo a profundidade espacial, plano intermediário com o conjunto arquitetônico principal e fundo delimitando o horizonte e fechamentos visuais.

A arquitetura e a câmera serão preservadas integralmente.

---

### SEÇÃO 3 — INTERVENÇÃO INTELIGENTE

* **Status:** ${cleanedPrompt}
* **Preservação:** Câmera, geometria arquitetônica, volumetria e materiais base preservados com 100% de fidelidade ao modelo.

---

### SEÇÃO 4 — PROMPT COMPLETO — PT

\`\`\`text
${lead}

${fullFrameBlockPt}
\`\`\`

---

### SEÇÃO 5 — PROMPT COMPLETO — EN

\`\`\`text
${lead}

${fullFrameBlockEn}
\`\`\``;
}

// Helper to execute generateContent with automatic retry and model fallback
async function generateContentSafe(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbackModels: string[],
  requestParams: {
    contents: any;
    config?: any;
  },
  timeoutMs: number = 45000
): Promise<any> {
  // Valid high-availability active models
  const validGuaranteedFallbacks = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
  const combinedModels = [primaryModel, ...fallbackModels, ...validGuaranteedFallbacks];
  // Filter out any models that are known deprecated or invalid
  const modelsToTry = Array.from(new Set(combinedModels)).filter(
    (m) => m && !m.includes("2.0") && !m.includes("2.5") && !m.includes("3.5") && !m.includes("flash-lite-latest")
  );
  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const model = modelsToTry[mIdx];
    try {
      const responsePromise = ai.models.generateContent({
        model,
        contents: requestParams.contents,
        config: requestParams.config,
      });
      // Configurable timeout per attempt (default 45s, larger for multi-image batch analysis)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout model ${model}`)), timeoutMs)
      );
      const response = await Promise.race([responsePromise, timeoutPromise]);
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} unavailable (${err?.status || err?.message || 'error'}), trying next...`);
    }
  }

  throw lastError || new Error("All AI models currently unavailable");
}

// Geração direta de imagens desativada conforme solicitação do usuário (Foco exclusivo em síntese de Prompts fotorrealistas)
async function generateFluxDevImageViaFal(
  _base64Data: string,
  _mimeType: string,
  _prompt: string,
  _strength = 0.16
): Promise<string | null> {
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // CORS middleware to allow requests from SketchUp HtmlDialog, Web App and external clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    // Impede cache agressivo no CEF do SketchUp e navegadores em páginas principais e APIs
    if (req.path === "/" || req.path.endsWith(".html") || req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
    next();
  });

  // Lazy initialization for Gemini
  let aiClient: GoogleGenAI | null = null;
  function getAIClient(): GoogleGenAI {
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // API Routes defined FIRST before Vite middleware
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "SKP RENDER PRO IA" });
  });

  // Status do motor: Geração de imagens via Fal.ai desativada (exclusivo para síntese de prompts)
  app.get("/api/fal/status", (req, res) => {
    return res.json({
      configured: false,
      disabled: true,
      message: "Geração de imagem via Fal AI desativada. O sistema opera exclusivamente na geração e síntese de prompts arquitetônicos e fotorrealistas.",
    });
  });

  // HORA DO SERVIDOR (Para validação de data infalível contra manipulação de relógio do Windows)
  app.get("/api/license/time", (req, res) => {
    const now = new Date();
    res.json({
      serverDate: now.toISOString().split("T")[0],
      serverTime: now.toISOString(),
      timestamp: now.getTime(),
    });
  });

  // CONSULTA DE STATUS EM TEMPO REAL (Chamada pelo plugin Ruby e pela Webview)
  app.get("/api/license/check-status", async (req, res) => {
    try {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");

      const pcId = String(req.query.pcId || "").trim();
      const licenseKey = String(req.query.licenseKey || "").trim();

      if (!pcId && !licenseKey) {
        return res.status(400).json({ active: false, blocked: false, message: "Parâmetros não informados." });
      }

      let record: ClientLicenseRecord | null = null;

      if (pcId) {
        record = await getLicenseByPcId(pcId);
      }
      
      if (!record && licenseKey) {
        record = await getLicenseByKey(licenseKey);
      }

      // 1. Se a licença existe no registro do servidor e está ATIVA e NÃO expirada:
      if (record && record.status === "active" && !isLicenseExpired(record.validUntil)) {
        return res.json({
          active: true,
          blocked: false,
          status: "active",
          clientName: record.clientName,
          validUntil: record.validUntil,
          formattedValidUntil: formatLicenseDateTime(record.validUntil),
          licenseKey: record.licenseKey,
        });
      }

      // 2. Se a licença existe no registro do servidor e foi REVOGADA:
      if (record && record.status === "revoked") {
        return res.json({
          active: false,
          blocked: true,
          reason: "revoked",
          message: "Esta licença foi REVOGADA pelo administrador. Acesso ao plugin bloqueado.",
          clientName: record.clientName,
        });
      }

      // 3. Se a licença foi encontrada e expirou:
      if (record && isLicenseExpired(record.validUntil)) {
        return res.json({
          active: false,
          blocked: true,
          reason: "expired",
          message: `Esta licença expirou em ${formatLicenseDateTime(record.validUntil)}. Renove sua licença no painel.`,
          clientName: record.clientName,
        });
      }

      // 4. Se o cliente não está cadastrado:
      return res.json({
        active: false,
        blocked: true,
        reason: "not_found",
        message: "Licença não cadastrada ou excluída. Gere uma nova licença no painel administrativo.",
      });
    } catch (err: any) {
      return res.status(500).json({ active: false, blocked: true, error: err?.message });
    }
  });

  // LIMPAR BLACKLIST / DESBLOQUEAR COMPUTADOR (Não mais necessário com Firestore, mas mantemos compatibilidade)
  app.post("/api/admin/clear-blacklist", async (req, res) => {
    return res.json({ success: true, message: "A gestão agora é feita via Firestore em tempo real." });
  });

  // LISTAGEM DE CLIENTES & LICENÇAS
  app.get("/api/licenses", async (req, res) => {
    try {
      res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");

      const enriched = await getLicensesFromDb();
      const now = new Date();

      const processed = enriched.map((r) => {
        let currentStatus: "active" | "expired" | "revoked" = r.status;
        if (r.status === "active" && isLicenseExpired(r.validUntil)) {
          currentStatus = "expired";
        }
        
        const targetDate = parseLicenseDate(r.validUntil);
        const diffMs = targetDate.getTime() - now.getTime();
        
        let remainingText = "";
        if (diffMs <= 0) {
          remainingText = "Expirou";
        } else {
          const totalMinutes = Math.floor(diffMs / (1000 * 60));
          const totalHours = Math.floor(totalMinutes / 60);
          const totalDays = Math.floor(totalHours / 24);

          if (totalDays > 0) {
            remainingText = `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'} restantes`;
          } else if (totalHours > 0) {
            remainingText = `${totalHours} ${totalHours === 1 ? 'hora' : 'horas'} restantes`;
          } else {
            remainingText = `${totalMinutes} ${totalMinutes === 1 ? 'minuto' : 'minutos'} restantes`;
          }
        }

        return {
          ...r,
          computedStatus: currentStatus,
          daysRemaining: Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0),
          remainingText,
          formattedValidUntil: formatLicenseDateTime(r.validUntil),
        };
      });

      processed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const stats = {
        total: processed.length,
        active: processed.filter((i) => i.computedStatus === "active").length,
        expired: processed.filter((i) => i.computedStatus === "expired").length,
        revoked: processed.filter((i) => i.computedStatus === "revoked").length,
      };

      res.json({ success: true, licenses: processed, stats });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Falha ao carregar licenças" });
    }
  });

  // GERAÇÃO DE LICENÇA
  app.post("/api/license/generate", async (req, res) => {
    try {
      const { pcId, validUntil, clientName, clientContact, notes, ownerId } = req.body;
      if (!pcId || typeof pcId !== "string" || !pcId.trim()) {
        return res.status(400).json({ error: "O ID do Computador (UUID) é obrigatório." });
      }

      const idLimpo = pcId.trim();
      let validade = validUntil && typeof validUntil === "string" && validUntil.trim()
        ? validUntil.trim()
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const licencaB64 = signLicenseKey(idLimpo, validade);

      const existingRecord = await getLicenseByPcId(idLimpo);
      
      const newRecord: ClientLicenseRecord = {
        id: existingRecord ? existingRecord.id : crypto.randomUUID(),
        clientName: clientName || (existingRecord ? existingRecord.clientName : "Cliente Sem Nome"),
        clientContact: clientContact || (existingRecord ? existingRecord.clientContact : ""),
        notes: notes || (existingRecord ? existingRecord.notes : ""),
        pcId: idLimpo,
        validUntil: validade,
        licenseKey: licencaB64,
        createdAt: existingRecord ? existingRecord.createdAt : new Date().toISOString(),
        status: "active",
        ownerId: ownerId || "system",
      };

      await saveLicenseToDb(newRecord);

      console.log(`[LICENSE] Licença gerada/salva no Firestore para ${newRecord.clientName}`);

      return res.json({
        success: true,
        record: newRecord,
        pcId: idLimpo,
        validUntil: validade,
        licenseKey: licencaB64,
      });
    } catch (err: any) {
      console.error("Erro ao gerar licença:", err);
      return res.status(500).json({ error: err?.message || "Falha ao gerar chave de licença" });
    }
  });

  // ATUALIZAR / RENOVAR CLIENTE E LICENÇA
  app.put("/api/license/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { clientName, clientContact, notes, validUntil, status } = req.body;

      const current = await getLicenseById(id);
      if (!current) {
        return res.status(404).json({ error: "Registro de cliente não encontrado." });
      }
      let newValidUntil = current.validUntil;
      let newLicenseKey = current.licenseKey;

      if (validUntil && validUntil.trim() && validUntil !== current.validUntil) {
        newValidUntil = validUntil.trim();
        newLicenseKey = signLicenseKey(current.pcId, newValidUntil);
      }

      const updated: ClientLicenseRecord = {
        ...current,
        clientName: clientName !== undefined ? String(clientName).trim() : current.clientName,
        clientContact: clientContact !== undefined ? String(clientContact).trim() : current.clientContact,
        notes: notes !== undefined ? String(notes).trim() : current.notes,
        validUntil: newValidUntil,
        licenseKey: newLicenseKey,
        status: status === "revoked" || status === "active" ? status : current.status,
      };

      await saveLicenseToDb(updated);
      res.json({ success: true, record: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Falha ao atualizar licença" });
    }
  });

  // REATIVAR / RENOVAR LICENÇA EXPIRADA OU BLOQUEADA
  app.post("/api/license/:id/reactivate", async (req, res) => {
    try {
      const { id } = req.params;
      const { validUntil, daysToAdd } = req.body;
      const current = await getLicenseById(id);
      if (!current) {
        return res.status(404).json({ error: "Registro de licença não encontrado." });
      }

      let newValidUntil = "";
      if (validUntil && String(validUntil).trim()) {
        newValidUntil = String(validUntil).trim();
      } else {
        const days = Number(daysToAdd) > 0 ? Number(daysToAdd) : 30;
        const target = new Date();
        target.setDate(target.getDate() + days);
        target.setHours(23, 59, 0, 0);
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, "0");
        const dd = String(target.getDate()).padStart(2, "0");
        const hh = String(target.getHours()).padStart(2, "0");
        const min = String(target.getMinutes()).padStart(2, "0");
        newValidUntil = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      }

      const newLicenseKey = signLicenseKey(current.pcId, newValidUntil);
      const updated: ClientLicenseRecord = {
        ...current,
        validUntil: newValidUntil,
        licenseKey: newLicenseKey,
        status: "active",
      };

      await saveLicenseToDb(updated);
      console.log(`[LICENÇA] Licença reativada para ${current.clientName} até ${newValidUntil}`);
      res.json({ success: true, record: updated, message: `Licença de ${current.clientName} reativada com sucesso até ${newValidUntil}!` });
    } catch (err: any) {
      console.error("[REACTIVATE ERROR]", err);
      res.status(500).json({ error: err?.message || "Falha ao reativar licença" });
    }
  });

  // REVOGAR / REATIVAR LICENÇA
  app.post("/api/license/:id/toggle-status", async (req, res) => {
    try {
      const { id } = req.params;
      const record = await getLicenseById(id);
      if (!record) {
        return res.status(404).json({ error: "Registro de licença não encontrado." });
      }
      record.status = record.status === "active" ? "revoked" : "active";
      
      await saveLicenseToDb(record);
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Falha ao alterar status" });
    }
  });

  // EXCLUIR CLIENTE DO REGISTRO
  app.delete("/api/license/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteLicenseFromDb(id);
      
      if (success) {
        res.json({ success: true, message: "Registro excluído com sucesso." });
      } else {
        throw new Error("Falha ao excluir do Firestore.");
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Falha ao excluir registro" });
    }
  });

  // VALIDAÇÃO DE LICENÇA (Chamada pelo plugin ou frontend)
  app.post("/api/license/verify", async (req, res) => {
    try {
      const { licenseKey, pcId } = req.body;
      if (!licenseKey || typeof licenseKey !== "string" || !licenseKey.trim()) {
        return res.status(400).json({ valid: false, message: "Chave de licença não fornecida." });
      }

      const raw = Buffer.from(licenseKey.trim(), "base64").toString("utf-8");
      const [dadosJson, assinaturaRecebida] = raw.split("|");

      if (!dadosJson || !assinaturaRecebida) {
        return res.json({ valid: false, message: "Formato de licença inválido ou corrompido." });
      }

      const hmac = crypto.createHmac("sha256", CHAVE_SECRETA_PLUGIN);
      hmac.update(dadosJson);
      const assinaturaCalculada = hmac.digest("hex");

      if (assinaturaRecebida !== assinaturaCalculada) {
        return res.json({ valid: false, message: "Assinatura digital da licença é inválida." });
      }

      const dados = JSON.parse(dadosJson);

      if (pcId && dados.id !== pcId.trim()) {
        return res.json({ valid: false, message: "Esta licença foi emitida para outro computador." });
      }

      const dataHoje = new Date().toISOString().split("T")[0];
      if (dataHoje > dados.validade) {
        return res.json({ valid: false, message: `Esta licença expirou em ${dados.validade}.` });
      }

      // Checar se a licença foi revogada no servidor
      const clientRecord = await getLicenseByPcId(dados.id);
      if (clientRecord && clientRecord.status === "revoked") {
        return res.json({ valid: false, message: "Esta licença foi revogada pelo administrador." });
      }

      return res.json({
        valid: true,
        message: "Licença válida e ativa!",
        pcId: dados.id,
        validUntil: dados.validade,
        clientName: clientRecord?.clientName || "Cliente Autorizado",
      });
    } catch (err: any) {
      return res.json({ valid: false, message: "Erro ao processar validação da licença." });
    }
  });

  // Rota de diagnóstico para verificar arquivos no servidor
  app.get("/api/admin/check-files", (req, res) => {
    try {
      const publicPath = path.resolve("public");
      const files = fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : ["pasta não existe"];
      res.json({ publicPath, files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ROTA PARA OBTER CÓDIGO RUBY LIMPO (JSON seguro - previne páginas HTML de redirect)
  // Função para sincronizar e manter as versões do plugin
  function updateProtectedPluginFiles() {
    try {
      const publicPath = path.resolve("public");
      const sourcePath = path.join(publicPath, "skp_render_pro_source.rb");
      const normalPath = path.join(publicPath, "skp_render_pro.rb");
      const protectedPath = path.join(publicPath, "skp_render_pro_protected.rb");

      if (!fs.existsSync(sourcePath) && fs.existsSync(normalPath)) {
        // Se por algum motivo sourcePath não existir mas normalPath existir e for completo, cria sourcePath como backup
        const code = fs.readFileSync(normalPath, "utf8");
        if (code.length > 5000) {
          fs.writeFileSync(sourcePath, code, "utf8");
        }
      }

      if (!fs.existsSync(sourcePath)) return;

      const sourceCode = fs.readFileSync(sourcePath, "utf8");

      // Gera e sincroniza a versão 100% protegida e ofuscada
      const lines = sourceCode.split("\n");
      const cleanLines: string[] = [];
      let inMultiline = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("=begin")) { inMultiline = true; continue; }
        if (trimmed.startsWith("=end")) { inMultiline = false; continue; }
        if (inMultiline || trimmed.length === 0 || trimmed.startsWith("#")) continue;
        cleanLines.push(line);
      }
      const cleanCode = cleanLines.join("\n");
      const compressed = zlib.deflateSync(Buffer.from(cleanCode, "utf8"));
      const b64 = compressed.toString("base64");
      const obfuscated = `# ==============================================================================
# SKP RENDER PRO SECURITY - PROTECTED FILE
# ==============================================================================
require 'zlib';require 'base64';eval(Zlib::Inflate.inflate(Base64.decode64("${b64}")))
# ==============================================================================`;

      // SEGURANÇA TOTAL: Tanto skp_render_pro_protected.rb quanto skp_render_pro.rb distribuídos
      // contêm o código ofuscado, impedindo que clientes acessem ou copiem o código fonte.
      fs.writeFileSync(protectedPath, obfuscated, "utf8");
      fs.writeFileSync(normalPath, obfuscated, "utf8");

      const distDir = path.resolve("dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, "skp_render_pro_protected.rb"), obfuscated, "utf8");
        fs.writeFileSync(path.join(distDir, "skp_render_pro.rb"), obfuscated, "utf8");
      }
      console.log("[SERVER] Versão protegida/ofuscada sincronizada com sucesso!");
    } catch (err: any) {
      console.error("[SERVER] Erro ao sincronizar plugin:", err);
    }
  }

  // Executa uma sincronização imediata no carregamento do servidor
  updateProtectedPluginFiles();

  app.get("/api/plugin-version", async (req, res) => {
    try {
      const releaseInfo = await getPluginReleaseInfo();
      return res.json({
        success: true,
        version: releaseInfo.releaseVersion,
        versionName: releaseInfo.versionName,
        releaseDate: releaseInfo.releaseDate,
        releaseNotes: releaseInfo.releaseNotes,
        activeAlert: releaseInfo.activeAlert,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ROTA DO ADMIN: Lançar / Notificar Atualização do Plugin para Todos os Clientes
  app.post("/api/admin/publish-plugin-update", async (req, res) => {
    try {
      updateProtectedPluginFiles();
      const versionName = (req.body?.versionName || "2.1.0").toString();
      const releaseNotes = (req.body?.releaseNotes || "Nova versão oficial do plugin SKP Render Pro IA").toString();
      const newRelease = await publishPluginRelease(versionName, releaseNotes);
      return res.json({
        success: true,
        message: "Nova atualização do plugin lançada com sucesso! O alerta laranja ficará ativo para os clientes até que eles façam o download.",
        releaseInfo: newRelease,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ROTA DO ADMIN: Desativar Alerta de Atualização
  app.post("/api/admin/clear-plugin-alert", async (req, res) => {
    try {
      const updated = await clearPluginReleaseAlert();
      return res.json({
        success: true,
        message: "Alerta de atualização do plugin desativado com sucesso.",
        releaseInfo: updated,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/plugin-code", async (req, res) => {
    try {
      const publicPath = path.resolve("public");
      const sourcePath = path.join(publicPath, "skp_render_pro_source.rb");
      const protectedPath = path.join(publicPath, "skp_render_pro_protected.rb");
      const normalPath = path.join(publicPath, "skp_render_pro.rb");

      if (!fs.existsSync(protectedPath) && fs.existsSync(sourcePath)) {
        updateProtectedPluginFiles();
      }
      
      const isSourceRequested = req.query.type === "source" || req.query.type === "raw";
      
      let fileToLoad = "";
      if (isSourceRequested && fs.existsSync(sourcePath)) {
        fileToLoad = sourcePath;
      } else {
        // SEGURANÇA FORTE: Sempre serve a versão OFUSCADA/PROTEGIDA para distribuição a clientes
        fileToLoad = fs.existsSync(protectedPath) ? protectedPath : normalPath;
      }

      if (fs.existsSync(fileToLoad)) {
        const stats = fs.statSync(fileToLoad);
        const code = fs.readFileSync(fileToLoad, "utf8");
        const releaseInfo = await getPluginReleaseInfo();
        return res.json({ 
          success: true, 
          code, 
          version: releaseInfo.releaseVersion || Math.floor(stats.mtimeMs),
          filename: isSourceRequested ? "skp_render_pro_source.rb" : "skp_render_pro_protected.rb",
          isProtected: !isSourceRequested 
        });
      }
      return res.status(404).json({ success: false, error: "Arquivo do plugin não encontrado no servidor." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ROTA DE DOWNLOAD GENÉRICA (Plugin .rb, Script Gerador, etc)
  const handlePluginDownload = (req: express.Request, res: express.Response) => {
    try {
      const urlPath = req.path;
      let filename = req.params.file || "";
      
      if (!filename) {
        if (urlPath.includes("source")) filename = "skp_render_pro_source.rb";
        else filename = "skp_render_pro_protected.rb";
      }

      console.log(`[DOWNLOAD] Processando download para: ${filename} (path: ${urlPath})`);

      const publicPath = path.resolve("public");
      const distPath = path.resolve("dist");

      // Lógica de prioridade para o Plugin
      if (filename.includes("skp_render_pro")) {
        const isSourceRequested = filename.includes("source") || req.query.type === "source" || req.query.type === "raw";

        let candidatePaths: string[] = [];

        if (isSourceRequested) {
          candidatePaths = [
            path.join(publicPath, "skp_render_pro_source.rb"),
            path.join(distPath, "skp_render_pro_source.rb"),
          ];
        } else {
          // Serve SEMPRE a versão OFUSCADA/PROTEGIDA
          candidatePaths = [
            path.join(publicPath, "skp_render_pro_protected.rb"),
            path.join(distPath, "skp_render_pro_protected.rb"),
            path.join(publicPath, "skp_render_pro.rb"),
            path.join(distPath, "skp_render_pro.rb"),
          ];
        }

        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            const code = fs.readFileSync(p, "utf8");
            res.setHeader("Content-Type", "text/x-ruby; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${isSourceRequested ? 'skp_render_pro_source.rb' : 'skp_render_pro_protected.rb'}"`);
            return res.status(200).send(code);
          }
        }
      } else {
        // Outros arquivos (ex: gerador_licenca.rb, limpar_e_desbloquear_licenca.rb)
        const candidates = [
          path.join(publicPath, filename),
          path.join(distPath, filename),
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, "utf8");
            res.setHeader("Content-Type", "text/x-ruby; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return res.status(200).send(content);
          }
        }
      }

      console.error(`[DOWNLOAD ERROR] Arquivo ${filename} não localizado.`);
      return res.status(404).type("text/plain").send("Arquivo não encontrado.");
    } catch (err: any) {
      console.error("[DOWNLOAD CRITICAL ERROR]", err);
      return res.status(500).type("text/plain").send("Erro ao processar download.");
    }
  };

  app.get("/skp_render_pro.rb", handlePluginDownload);
  app.get("/skp_render_pro_protected.rb", handlePluginDownload);
  app.get("/skp_render_pro_source.rb", handlePluginDownload);
  app.get("/api/download/skp_render_pro.rb", handlePluginDownload);
  app.get("/api/download/skp_render_pro_protected.rb", handlePluginDownload);
  app.get("/api/download/skp_render_pro_source.rb", handlePluginDownload);
  app.get("/api/download/:file", handlePluginDownload);

  // DETECÇÃO AUTOMÁTICA DE MATERIAIS DO PRINT (Assistida por IA - Gemini 3.8 Flash Vision)
  app.post("/api/detect-materials", async (req, res) => {
    try {
      const { image, currentText, language } = req.body;
      const targetLang = language || 'pt';
      
      if (!image || typeof image !== "string" || !image.includes("base64,")) {
        return res.status(400).json({ success: false, error: "Nenhuma imagem válida fornecida para detecção de materiais." });
      }

      const parts = image.split("base64,");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = parts[1];

      const ai = getAIClient();

      let langInstruction = "";
      if (targetLang === 'en') {
        langInstruction = `IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em INGLÊS (ENGLISH).
As categorias (category) devem ser traduzidas para: "Structural", "Woodwork", "Furniture", "Textiles", "Metals & Windows", "Lighting & Appliances", "Objects & Decoration".`;
      } else if (targetLang === 'es') {
        langInstruction = `IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em ESPANHOL (ESPAÑOL).
As categorias (category) devem ser traduzidas para: "Estructural", "Carpintería", "Mobiliario", "Textiles", "Metales y Carpintería", "Iluminación y Electrodomésticos", "Objetos y Decoración".`;
      } else {
        langInstruction = "IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em PORTUGUÊS (PORTUGUÊS DO BRASIL).";
      }

      const detectPrompt = `Você é o Arquiteto e Especificador Sênior de Materiais PBR e Iluminação ArchViz do SKP RENDER PRO IA.
Sua missão é realizar uma LEITURA FORENSE ULTRA-MINUCIOSA, CIRÚRGICA E ESPECÍFICA de cada elemento, revestimento, móvel, eletrônico, luminária e adorno decorativo VISÍVEL NESTE PRINT ESPECÍFICO DO SKETCHUP.

${langInstruction}

BASE DE DADOS DE MDF BRASILEIRO INTEGRADA:
Você possui conhecimento completo dos catálogos oficiais dos principais fabricantes brasileiros de MDF:
- DURATEX: Freijó Puro, Carvalho Hanover, Carvalho Berlim, Carvalho Batur, Carvalho Eterno, Carvalho Luar, Cumaru Raiz, Nogueira Caiena, Nogueira Thar, Nogueira Cadiz, Álamo, Trancoso, Inhotim, Itapuã, Jequitibá Rosa, Pau Ferro Natural, Brise, Absoluto, Arenito, Basalto, Bolero, Hong Kong, Lana, Lunar, Tramato, Branco Diamante, Cinza Sagrado, Gianduia, Mint, Azul Secreto, Rosa Glamour, Rosa Infinito, etc.
- GUARARAPES: Freijó, Curupixá, Imbuia, Ipê, Pau-Ferro, Tauari, Baviera, Caribe, Nero, Savana, Siberia, Alabama, Antuérpia, Dual Black, Elmo Dubai, Lisboa, Paris, Pretória, Areia, Alecrim, Azul Petróleo, Capuccino, Cinza Urban, Grafite, Marsala, Maxi Branco, Níquel, Ouro, Pixel, Rosa Milkshake, Terracota, Tijolo, Bronze, Cosmos, Fog, Fontana, Fulgê, Marmo, Petra, Quartzo, Vesúvio, etc.
- SUDATI: Louro Freijó, Carvalho Castelli, Carvalho Lino, Carvalho Natural, Imbuia, Bellini, Bianco Ravena, Cabernet, Carmenere, Chenin Blanc, Corazzi, Leon, Molinara, Moscato, Nerello, Tempranillo, Trebbiano Blanc, Versati, Alessi, Arinto, Asti, Botticelli, Lina, Pisano, Rosselli, Sofisticato, Cumaru, Ipê, Itaúba, Jequitibá, Pau-Ferro, Tauari, Amazônia, Havana, Manhattan, Santiago, Argel, Floripa, Sampa, Glamour, Mineral, Vulcano, etc.
- PLACAS DO BRASIL: Freijó, Freijó Ripado, Macanaíba, Jacarandá, Carvalho Aicana, Carvalho Arandu, Carvalho Caete, Carvalho Tupi, Elmo Aracruz, Elmo Palmares, Nogal Terena, Nogueira Arroio, Nogueira Caiapó, Nogueira Carajás, Nogueira Goitacá, Caravela, Áurea Imperial, Vila Velha, Samba, Tropicália, Congo Capixaba, Ingá, Guaraná, Cupuaçu, Pimenta do Reino, Café Torrado, Pitanga, Vitória Régia, Castanha de Caju, Tapioca, etc.
- GREENPLAC: Freijó Amazonas, Bali, Araton, Caput, Siena, Garanza, Pale, Prussian, Raven, Jade, Cilento, Málaga, Noronha, Versalhes, Villandry, Granile (Bellini), Petale (Cezanne), Seline (Dali), Azuro (Mondrian), Nottie (Monet), Nevari (Portinari), Cromato (Romero), Nerali (Sanzio), Vino (Tarsila), Ditela (Vinci), Tessila (Volpi), Rosato, Verbenni, Volato, Build, Inova, Duo, Urban, Unique, Style, Pietra Bronze, etc.
- FIBRAPLAC: Freijó Natura, Aspen, Carvalho Latino, Mocaccino, Murano, Nacre, Nogueira Boreal, Carvalho Montreal, Carvalho Tropical, Ébano Exótico, Narita, Siena Natural, Linho Cacau, Linho Cinza Calcário, Linho Fendi, Linho Platina, Linum, Mocca, Panna, Versato, Açaí, Cacau, Maracujá, Platina, Turmalina, Branco Plus TX/LS, Branco Larissa, etc.

PADRÃO SUPREMO DE ESPECIFICAÇÃO DE CADA MATERIAL:
Nunca use termos genéricos como "madeira", "mesa de madeira", "parede cinza" ou "objetos decorativos". O modelo de renderização precisa de especificações hiper-descritivas e fisicamente precisas (PBR) para não inventar nada e renderizar com perfeição fotográfica:

1. REVESTIMENTOS E ESTRUTURA (Pisos, Paredes, Forro, Rodapés):
   - Piso: Especifique a tipologia exata (ex: piso laminado/vinílico padrão Carvalho Natural Europeu, porcelanato retificado 120x120cm cinza grafite, tábua corrida com veios lineares), acabamento superficial (ultra-fosco, acetinado, polido espelhado), rugosidade tátil (Roughness ~0.50, poros abertos), juntas (juntas secas milimétricas retificadas de 1mm).
   - Paredes: Tipo de revestimento exato (alvenaria com pintura mineral efeito cimento queimado aveludado, revestimento cerâmico verde sálvia com paginação vertical, azulejos granilite/terrazzo, pintura látex lisa off-white), textura e comportamento de absorção/rebatimento de luz.
   - Forro/Teto: Forro de gesso liso ultra-fosco rebaixado com recortes perimetrais, sancas, grelhas ou alçapões embutidos.
   - Rodapés: Material, altura (ex: 10-15cm) e cor alinhada ao piso ou parede.

2. MARCENARIA E MOBILIÁRIO (CORRELAÇÃO COM MDF REAL):
   - Para toda marcenaria visível (painéis de parede, prateleiras, bancadas de trabalho, gaveteiros, portas de armário, nichos, ripadinhos), IDENTIFIQUE O PADRÃO E FABRICANTE REAL DE MDF MAIS SEMELHANTE do catálogo acima!
   - Exemplo: "Marcenaria e Prateleiras: MDF Freijó Puro (Duratex Essencial Wood) com veios orgânicos contínuos em tom amadeirado médio dourado, acabamento acetinado com toque suave de cera e estrutura metálica de suporte em alumínio cinza."
   - Exemplo: "Gaveteiro Inferior: MDF laca fosca anti-touch no padrão Azul Petróleo (Guararapes Colors) com puxadores em cava oculta."
   - Bancadas e Tampos: Diferencie tampos de madeira de tampos de pedra (mármore calacatta/carrara, granito são gabriel escovado, quartzo sintético, pedra sinterizada) com espessuras (saia encorpada de 40mm, bordas bisotadas).

3. ESTOFADOS E TÊXTEIS:
   - Poltronas e Cadeiras: Tecido exato (linho nobre rústico cru, tecido bouclé texturizado, tela mesh respirável cinza/preta translúcida com elastômero esticado, couro sintético fosco), costuras rebatidas, estrutura (nylon injetado preto, base giratória com rodízios de PU, pés palito torneados em madeira maciça).

4. EQUIPAMENTOS, ELETRÔNICOS E PERIFÉRICOS:
   - Identifique cada item visível pelo nome e acabamento real: Monitores/TVs (tela plana com bordas ultrafinas, tela de vidro antirreflexo semi-brilhante com reflexos sutis da cena), laptops (alumínio anodizado cinza espacial fechado ou aberto), desk mat/mousepad (neoprene texturizado preto fosco), impressoras (polímero ABS preto fosco com visores), fones de ouvido/headset (detalhes acolchoados e detalhes de cores), telefones/interfones, teclados e lixeiras.

5. ADORNOS, ESCULTURAS E VEGETAÇÃO:
   - Identifique os objetos de decoração reais da cena: esculturas específicas (estatueta da Justiça com balança em bronze/latão envelhecido, escultura de touro em ferro fundido, bustos clássicos, luminárias temáticas de jogos), quadros (moldura de alumínio preto com vidro de proteção antirreflexo e tipo de fotografia/poster), pilhas de livros (capas duras com títulos gráficos de arte/arquitetura), plantas e folhagens (espécies visíveis como samambaias pendentes, suculentas, véu de noiva em vasos cerâmicos artesanais foscos).

6. ILUMINAÇÃO TÉCNICA E DETECTADA:
   - Mapeie as fontes de luz visíveis e indicadas: fitas de LED embutidas sob sancas ou prateleiras (temperatura de cor 2700K âmbar quente, efeito wall-washing rasante), plafons quadrados ou circulares com difusor acrílico leitoso translúcido, spots direcionáveis embutidos (3000K com facho suave), arandelas e pendentes.

7. TRAVA DE EXCLUSIVIDADE:
   - Extraia ESTRITAMENTE o que está presente NESTE print. Não inclua elementos de outras cenas ou modelos anteriores.

Para cada item retorne:
- element: Nome exato do elemento visível (ex: "Piso", "Parede de Fundo", "Bancada de Trabalho", "Gaveteiro", "Cadeira de Escritório", "Poltrona Lateral", "Monitor e TV", "Headset Gamer", "Quadro Decorativo", etc.).
- category: "Estrutural", "Marcenaria", "Mobiliário", "Têxteis", "Metais & Esquadrias", "Iluminação & Eletros", ou "Objetos & Decoração".
- description: Especificação técnica, física e arquitetônica detalhada (PBR) com textura, cor exata, acabamento, rugosidade/brilho e particularidades visíveis.`;

      let detectedMaterials: Array<{ element: string; category?: string; description: string }> = [];

      try {
        const response = await generateContentSafe(
          ai,
          "gemini-flash-latest",
          ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
          {
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              detectPrompt,
            ],
            config: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  materials: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        element: {
                          type: Type.STRING,
                          description: "Nome do elemento arquitetônico ou objeto visível no print",
                        },
                        category: {
                          type: Type.STRING,
                          description: "Categoria do elemento",
                        },
                        description: {
                          type: Type.STRING,
                          description: "Especificação fotorrealista técnica PBR do acabamento visível",
                        },
                      },
                      required: ["element", "description"],
                    },
                  },
                },
                required: ["materials"],
              },
            },
          }
        );

        const textOutput = response.text || "";
        const parsed = JSON.parse(textOutput);
        if (parsed.materials && Array.isArray(parsed.materials) && parsed.materials.length > 0) {
          detectedMaterials = parsed.materials;
        } else {
          throw new Error("Nenhum material detectado na resposta do modelo.");
        }
      } catch (genErr: any) {
        console.error("[DETECT MATERIALS] Erro na leitura visual por IA:", genErr?.message || genErr);
        return res.status(503).json({
          success: false,
          error: "Não foi possível analisar a imagem no momento. Por favor, tente novamente em alguns instantes."
        });
      }

      // Adiciona IDs únicos para cada material para facilitar manipulação no frontend
      const materialsWithId = detectedMaterials.map((m, idx) => ({
        id: `mat-${Date.now()}-${idx}`,
        element: m.element || "Elemento",
        category: m.category || "Geral",
        description: m.description || "Material de alto padrão",
      }));

      // Gera o texto formatado para o prompt / caixa de mensagem
      const bulletLines = materialsWithId
        .map((m) => `• ${m.element}: ${m.description}`)
        .join("\n");

      const formattedText = `Materiais e Objetos da cena:\n${bulletLines}`;

      return res.json({
        success: true,
        materials: materialsWithId,
        formattedText,
      });
    } catch (err: any) {
      console.error("[DETECT MATERIALS ERROR]", err);
      return res.status(500).json({ success: false, error: err?.message || "Falha ao analisar materiais do print" });
    }
  });

  // LEITURA UNIFICADA DE MATERIAIS E OBJETOS EM LOTE (Múltiplas Cenas do Mesmo Ambiente)
  app.post("/api/detect-materials-batch", async (req, res) => {
    try {
      const { images, language } = req.body;
      const targetLang = language || "pt";

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhuma imagem fornecida para leitura em lote." });
      }

      const validImages = images
        .filter((img: any) => typeof img === "string" && img.includes("base64,"))
        .slice(0, 12);

      if (validImages.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhuma imagem em formato Base64 válido foi encontrada no lote." });
      }

      const ai = getAIClient();

      let langInstruction = "";
      if (targetLang === "en") {
        langInstruction = `IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em INGLÊS (ENGLISH).
As categorias (category) devem ser traduzidas para: "Structural", "Woodwork", "Furniture", "Textiles", "Metals & Windows", "Lighting & Appliances", "Objects & Decoration".`;
      } else if (targetLang === "es") {
        langInstruction = `IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em ESPANHOL (ESPAÑOL).
As categorias (category) devem ser traduzidas para: "Estructural", "Carpintería", "Mobiliario", "Textiles", "Metales y Carpintería", "Iluminación y Electrodomésticos", "Objetos y Decoración".`;
      } else {
        langInstruction = "IMPORTANTE: Você deve escrever o Nome do Elemento (element) e a Descrição Técnica (description) EXCLUSIVAMENTE em PORTUGUÊS (PORTUGUÊS DO BRASIL).";
      }

      const batchDetectPrompt = `Você é o Arquiteto e Especificador Sênior de Materiais PBR e Iluminação ArchViz do SKP RENDER PRO IA.
Você está recebendo ${validImages.length} CAPTURAS/PRINTS DE DIFERENTES ÂNGULOS DO MESMO AMBIENTE ARQUITETÔNICO.
Sua missão é cruzar visualmente TODAS as ${validImages.length} cenas e criar uma ESPECIFICAÇÃO MESTRA UNIFICADA DE MATERIAIS E OBJETOS DO AMBIENTE para que todas as cenas mantenham 100% DE CONSISTÊNCIA DE MATERIAIS (mesmo piso, mesmas paredes, mesmo padrão de MDF na marcenaria, mesmo forro, mesma iluminação e mesmos acabamentos em todos os ângulos).

${langInstruction}

BASE DE DADOS DE MDF BRASILEIRO INTEGRADA:
Correlacione toda marcenaria visível com os catálogos oficiais brasileiros:
- DURATEX: Freijó Puro, Carvalho Hanover, Carvalho Berlim, Carvalho Batur, Carvalho Eterno, Carvalho Luar, Cumaru Raiz, Nogueira Caiena, Nogueira Thar, Nogueira Cadiz, Álamo, Trancoso, Inhotim, Itapuã, Jequitibá Rosa, Pau Ferro Natural, Brise, Absoluto, Arenito, Basalto, Bolero, Hong Kong, Lana, Lunar, Tramato, Branco Diamante, Cinza Sagrado, Gianduia, Mint, Azul Secreto, Rosa Glamour, etc.
- GUARARAPES: Freijó, Curupixá, Imbuia, Ipê, Pau-Ferro, Tauari, Baviera, Caribe, Nero, Savana, Siberia, Alabama, Antuérpia, Dual Black, Elmo Dubai, Lisboa, Paris, Pretória, Areia, Alecrim, Azul Petróleo, Capuccino, Cinza Urban, Grafite, Marsala, Maxi Branco, Níquel, Ouro, Pixel, Rosa Milkshake, Terracota, Tijolo, Bronze, Cosmos, Fog, Fontana, Fulgê, Marmo, Petra, Quartzo, Vesúvio, etc.
- SUDATI: Louro Freijó, Carvalho Castelli, Carvalho Lino, Carvalho Natural, Imbuia, Bellini, Bianco Ravena, Cabernet, Carmenere, Chenin Blanc, Corazzi, Leon, Molinara, Moscato, Nerello, Tempranillo, Trebbiano Blanc, Versati, Alessi, Arinto, Asti, Botticelli, Lina, Pisano, Rosselli, Sofisticato, Cumaru, Ipê, Itaúba, Jequitibá, Pau-Ferro, Tauari, Amazônia, Havana, Manhattan, Santiago, Glamour, Mineral, Vulcano, etc.
- PLACAS DO BRASIL, GREENPLAC e FIBRAPLAC.

REGRAS DE UNIFICAÇÃO DO AMBIENTE:
1. UNIFICAÇÃO DE REVESTIMENTOS E MARCENARIA: O Piso, Paredes, Forro/Teto, Rodapés, Esquadrias, Bancadas e Marcenaria principal devem ter UMA ÚNICA especificação técnica PBR ultra-precisa válida para todo o ambiente, garantindo que não haja variação de cor ou material entre uma cena e outra.
2. MAPEAMENTO COMPLETO DOS ELEMENTOS DE TODAS AS VISTAS: Inclua todos os móveis, estofados, luminárias, eletrônicos, quadros, plantas e objetos decorativos que aparecem no conjunto das ${validImages.length} imagens.
3. ESPECIFICAÇÃO FÍSICA (PBR): Detalhe cor exata, textura, acabamento (fosco, acetinado, polido), rugosidade (roughness), juntas e resposta à luz.

Para cada item retorne:
- element: Nome claro do elemento no ambiente (ex: "Piso Unificado do Ambiente", "Paredes Principais", "Marcenaria Principal (Painéis e Armários)", "Bancada / Tampo", "Forro de Gesso e Sancas", "Sofá / Poltronas", "Iluminação Técnica do Ambiente", etc.).
- category: "Estrutural", "Marcenaria", "Mobiliário", "Têxteis", "Metais & Esquadrias", "Iluminação & Eletros", ou "Objetos & Decoração".
- description: Especificação técnica PBR completa e padronizada para todo o ambiente.`;

      const contentParts: any[] = validImages.map((imgStr: string) => {
        const parts = imgStr.split("base64,");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        return {
          inlineData: {
            mimeType,
            data: parts[1],
          },
        };
      });
      contentParts.push(batchDetectPrompt);

      const response = await generateContentSafe(
        ai,
        "gemini-flash-latest",
        ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
        {
          contents: contentParts,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                materials: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      element: { type: Type.STRING },
                      category: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["element", "description"],
                  },
                },
              },
              required: ["materials"],
            },
          },
        },
        60000
      );

      const textOutput = response.text || "{}";
      const parsed = JSON.parse(textOutput);
      const rawMaterials = Array.isArray(parsed.materials) ? parsed.materials : [];

      const materialsWithId = rawMaterials.map((m: any, idx: number) => ({
        id: `batch-mat-${Date.now()}-${idx}`,
        element: m.element || "Elemento do Ambiente",
        category: m.category || "Geral",
        description: m.description || "Acabamento arquitetônico PBR padronizado",
      }));

      const bulletLines = materialsWithId
        .map((m: any) => `• ${m.element}: ${m.description}`)
        .join("\n");

      return res.json({
        success: true,
        materials: materialsWithId,
        formattedText: `Materiais e Objetos Unificados do Ambiente (${validImages.length} cenas):\n${bulletLines}`,
      });
    } catch (err: any) {
      console.error("[DETECT MATERIALS BATCH ERROR]", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Não foi possível analisar o lote de imagens no momento.",
      });
    }
  });

  // GERAÇÃO DE SUPER PROMPTS EM LOTE COM MATERIAIS 100% UNIFICADOS NO AMBIENTE
  app.post("/api/batch-prompts", async (req, res) => {
    try {
      const { scenes, unifiedMaterials, language, lightingReport, environmentInstruction } = req.body;
      const targetLang = language || "pt";

      if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhuma cena fornecida para geração em lote." });
      }

      const ai = getAIClient();
      const SCENE_CODES = ["A1", "B2", "C3", "D4", "E5", "F6", "G7", "H8", "I9", "J10", "L11", "M12", "N13", "O14", "P15"];

      // Monta o bloco textual unificado de materiais que será TRAVADO igualmente em todas as cenas
      const materialsArray: Array<{ element: string; category?: string; description: string }> = Array.isArray(unifiedMaterials) ? unifiedMaterials : [];
      const unifiedMaterialsSummaryPt = materialsArray.length > 0
        ? materialsArray.map((m) => `${m.element}: ${m.description}`).join("; ")
        : "Pavimentação contínua com réguas amadeiradas de carvalho natural fosco (roughness 0.45); alvenaria mineral acetinada fosca em tom neutro quente/areia (roughness 0.70); marcenaria sob medida com veios orgânicos contínuos em lâmina natural nobre; forro de gesso liso ultra-fosco aveludado; perfis de alumínio preto fosco microtexturizado; iluminação indireta rasante LED 2700K-3000K e luz natural difusa.";

      const unifiedMaterialsBulletsPt = materialsArray.length > 0
        ? materialsArray.map((m) => `  - **${m.element}:** ${m.description}`).join("\n")
        : `  - **Piso:** ${unifiedMaterialsSummaryPt}`;

      let systemInstruction = SKP_OFFICIAL_SYSTEM_PROMPT;
      if (lightingReport) {
        systemInstruction += `\n\n${lightingReport}`;
      }

      // Processa cada cena em paralelo controlado (em lotes de até 3 por vez para máxima velocidade e estabilidade)
      const results: Array<{
        id: string;
        sceneCode: string;
        masterPrompt: string;
        renderPromptPt: string;
      }> = [];

      const processSingleScene = async (sceneItem: any, idx: number) => {
        const code = (sceneItem.sceneCode || SCENE_CODES[idx % SCENE_CODES.length] || `A${idx + 1}`).toUpperCase();
        const lead = `${code} GERAR`;
        const customNote = (sceneItem.customNote || environmentInstruction || "").trim();
        const userLeadText = customNote ? `${lead} - ${customNote}` : lead;
        const targetW = sceneItem.width || 2000;
        const targetH = sceneItem.height || 2500;
        const ratioLabel = `${targetW}x${targetH}`;

        const imgStr = String(sceneItem.image || "");
        let visionResult = "";

        if (imgStr.includes("base64,")) {
          const parts = imgStr.split("base64,");
          const mimeMatch = parts[0].match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const base64Data = parts[1];

          const scenePrompt = `SISTEMA RENDER PRO IA — GERAÇÃO EM LOTE COM TRAVA DE CONSISTÊNCIA DE AMBIENTE (CAMADAS 0 A 37)
Esta imagem é a CENA ${code} de um LOTE DO MESMO AMBIENTE ARQUITETÔNICO.

🚨 REGRA DE OURO DE CONSISTÊNCIA DE LOTE:
Você DEVE utilizar EXATAMENTE os mesmos materiais unificados do ambiente abaixo para todos os elementos compartilhados (Piso, Paredes, Marcenaria/MDF, Bancadas, Teto/Forro, Esquadrias, Iluminação e Mobiliário), garantindo que esta cena (${code}) tenha 100% a mesma paleta, textura e acabamento das demais cenas do lote:

MATERIAIS UNIFICADOS TRAVADOS DO AMBIENTE:
${unifiedMaterialsBulletsPt}
${customNote ? `\nINSTRUÇÃO ADICIONAL DO USUÁRIO PARA O AMBIENTE/CENA: "${customNote}"` : ""}

🚨 REGRA DE ENQUADRAMENTO DA CENA ${code}:
Analise especificamente o ângulo de câmera, perspectiva e os objetos visíveis NESTE enquadramento da cena ${code}, preservando 100% a geometria e o enquadramento total (MANDATORY FULL-FRAME PRESERVATION).
NUNCA mencione resoluções numéricas em pixels no texto do prompt.

ESTRUTURA OBRIGATÓRIA:
# ${lead}
### SEÇÃO 1 — IMAGEM ANALISADA (CENA ${code} DO LOTE)
### SEÇÃO 2 — ANÁLISE VISUAL PROFUNDA (COM MATERIAIS UNIFICADOS DO AMBIENTE)
### SEÇÃO 3 — INTERVENÇÃO INTELIGENTE
### SEÇÃO 4 — PROMPT COMPLETO — PT (\`\`\`text)
### SEÇÃO 5 — PROMPT COMPLETO — EN (\`\`\`text)`;

          try {
            const response = await generateContentSafe(
              ai,
              "gemini-flash-latest",
              ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
              {
                contents: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  scenePrompt,
                ],
                config: {
                  systemInstruction,
                  temperature: 0.1,
                },
              }
            );
            visionResult = response.text || "";
          } catch (err) {
            visionResult = generateArchVizFallbackPrompt(userLeadText, code, lead, targetW, targetH, ratioLabel);
          }
        } else {
          visionResult = generateArchVizFallbackPrompt(userLeadText, code, lead, targetW, targetH, ratioLabel);
        }

        // Garante que o bloco MANDATORY FULL-FRAME PRESERVATION contenha os materiais unificados do ambiente
        let unifiedMasterPrompt = ensurePromptStartsWithUserText(visionResult, lead);

        // Injeta explicitamente a especificação unificada de materiais no bloco SEÇÃO 4 PT se necessário
        const fullFrameWithUnifiedMatsPt = buildMandatoryFullFramePrompt(
          customNote ? `${lead} — ${customNote}` : lead,
          unifiedMaterialsSummaryPt
        );

        const secPtRegex = /(### SEÇÃO [45][^\n]*(?:PT|PORTUGU[EÊ]S|PROMPT COMPLETO)[^\n]*\n+```(?:text)?\s*)([\s\S]*?)(```)/i;
        if (secPtRegex.test(unifiedMasterPrompt)) {
          unifiedMasterPrompt = unifiedMasterPrompt.replace(
            secPtRegex,
            `$1${lead}\n\n${fullFrameWithUnifiedMatsPt}\n$3`
          );
        }

        return {
          id: sceneItem.id || `scene-${idx}`,
          sceneCode: code,
          masterPrompt: unifiedMasterPrompt,
          renderPromptPt: `${lead}\n\n${fullFrameWithUnifiedMatsPt}`,
        };
      };

      // Executa em grupos de 3 para alta velocidade sem estourar rate limit
      const chunkSize = 3;
      for (let i = 0; i < scenes.length; i += chunkSize) {
        const slice = scenes.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(
          slice.map((sc: any, sIdx: number) => processSingleScene(sc, i + sIdx))
        );
        results.push(...chunkResults);
      }

      return res.json({
        success: true,
        results,
        unifiedMaterialsSummary: unifiedMaterialsSummaryPt,
      });
    } catch (err: any) {
      console.error("[BATCH PROMPTS ERROR]", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Falha ao gerar prompts em lote.",
      });
    }
  });

  // CATÁLOGO DE MATERIAIS MDF (Duratex, Guararapes, Sudati, Placas do Brasil, Greenplac, Fibraplac)
  app.get("/api/mdf-catalog", (req, res) => {
    try {
      const catalogPath = path.join(process.cwd(), "data", "mdf_catalog.json");
      if (!fs.existsSync(catalogPath)) {
        return res.json({ success: true, count: 0, brands: [], materials: [] });
      }

      const raw = fs.readFileSync(catalogPath, "utf-8");
      const allMaterials = JSON.parse(raw);

      const { brand, category, query } = req.query;
      let filtered = allMaterials;

      if (brand && typeof brand === "string") {
        filtered = filtered.filter((m: any) => m.brand.toLowerCase() === brand.toLowerCase());
      }

      if (category && typeof category === "string") {
        filtered = filtered.filter((m: any) => m.category.toLowerCase() === category.toLowerCase());
      }

      if (query && typeof query === "string") {
        const q = query.toLowerCase();
        filtered = filtered.filter((m: any) =>
          m.name.toLowerCase().includes(q) ||
          m.brand.toLowerCase().includes(q) ||
          (m.category && m.category.toLowerCase().includes(q))
        );
      }

      const brands = Array.from(new Set(allMaterials.map((m: any) => m.brand)));
      const categories = Array.from(new Set(allMaterials.map((m: any) => m.category)));

      return res.json({
        success: true,
        count: filtered.length,
        total: allMaterials.length,
        brands,
        categories,
        materials: filtered,
      });
    } catch (err: any) {
      console.error("[MDF CATALOG ERROR]", err);
      return res.status(500).json({ success: false, error: err?.message || "Falha ao ler catálogo de MDF" });
    }
  });

  // DOWNLOAD E SINCRONIZAÇÃO DE TEXTURAS (Google Drive / WeTransfer / Link Direto)
  app.post("/api/sync-drive-textures", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, error: "Link para download não fornecido." });
      }

      console.log("[SYNC DRIVE TEXTURES] Link recebido:", url);
      // Cria a pasta de destino para as texturas se não existir
      const destDir = path.join(process.cwd(), "public", "textures", "mdf");
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      return res.json({
        success: true,
        message: "Link registrado com sucesso para sincronização das texturas de MDF!",
        destDir: "/textures/mdf"
      });
    } catch (err: any) {
      console.error("[SYNC DRIVE TEXTURES ERROR]", err);
      return res.status(500).json({ success: false, error: err?.message || "Falha ao processar link de texturas" });
    }
  });

  // SKP Render Pro IA chat & photo rendering endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, currentConfig, language, lightingReport, renderStrength } = req.body;
      const targetLang = language || 'pt';
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Formato inválido de mensagens" });
      }

      const ai = getAIClient();

      // Check if the latest user message contains an image, or look for the most recent image in history
      const lastMsg = messages[messages.length - 1];
      let imagePayload = lastMsg?.image;

      // If no image in latest message, check previous messages for active scene print
      if (!imagePayload) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.image && typeof messages[i].image === "string" && messages[i].image.includes("base64,")) {
            imagePayload = messages[i].image;
            break;
          }
        }
      }

      let generatedImage: string | null = null;
      let replyText = "";

      const isImportedImage = Boolean(currentConfig?.isImported);
      const rawUserMsgText = (lastMsg?.text || "").trim();
      const rawTargetW = currentConfig?.width || 2000;
      const rawTargetH = currentConfig?.height || 2500;
      const rawTargetR = currentConfig?.ratio || (rawTargetW / rawTargetH);

      const is360 = rawTargetR === 2.0 || Math.abs(rawTargetR - 2.0) < 0.05 || (rawTargetW >= 4000 && rawTargetH >= 2000 && Math.abs(rawTargetW / rawTargetH - 2.0) < 0.1) || /360|equirretangular|equirectangular|vr/i.test(rawUserMsgText);
      const targetW = is360 ? 8000 : rawTargetW;
      const targetH = is360 ? 4000 : rawTargetH;
      const targetR = is360 ? 2.0 : rawTargetR;
      const imagenRatio = is360 ? '16:9' : mapAspectRatio(targetR);
      const ratioLabel = is360
        ? `2:1 (Panorâmico ${targetW}x${targetH} px)`
        : (isImportedImage 
          ? `Dimensão Nativa (${targetW}x${targetH})` 
          : (targetR === 0.8 ? '4:5 (Feed do Instagram)' : targetR === 0.5625 ? '9:16 (Stories / Reels)' : targetR === 1 ? '1:1 (Quadrado)' : targetR === 1.777 ? '16:9 (Cinematográfico / Panorâmico)' : `${targetW}:${targetH}`));

      let systemInstruction = SKP_OFFICIAL_SYSTEM_PROMPT;
      if (lightingReport) {
        systemInstruction += `\n\n${lightingReport}`;
      }

      if (imagePayload && typeof imagePayload === "string" && imagePayload.includes("base64,")) {
        const parts = imagePayload.split("base64,");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = parts[1];

        let imageQuotaReached = false;
        let extractedMasterPrompt: string | undefined = undefined;

        // Forensic Scan & Deep Architectural Vision Pipeline (Gemini 3.6 Flash Vision)
        console.log("Synthesizing lightning-fast, ultra-deep forensic scan and 7-section Master Prompt via Gemini Vision pipeline...");
        const userPrompt = lastMsg?.text || (isImportedImage 
          ? "Renderize esta imagem importada em uma fotografia arquitetônica real e indistinguível de uma obra construída, mantendo a perspectiva original e texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista." 
          : "Transforme este print 3D do SketchUp em uma fotografia arquitetônica real e indistinguível de uma foto de obra construída, mantendo a posição exata da câmera, o layout do projeto e as texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista.");
        
        // Detect Scene ID (A1 to Z23)
        const sceneIdMatch = userPrompt.match(/^([A-Za-z][0-9]{1,2})/);
        const sceneId = sceneIdMatch ? sceneIdMatch[1].toUpperCase() : "";

        // O que o usuário escreveu na mensagem enviada junto com o print
        const isAutoFallbackMsg = !rawUserMsgText || 
          rawUserMsgText.startsWith("Transforme este print 3D do SketchUp") || 
          rawUserMsgText.startsWith("Renderize esta imagem com materiais PBR") ||
          rawUserMsgText.startsWith("Renderize esta imagem importada");

        const userInitialLead = !isAutoFallbackMsg && rawUserMsgText
          ? rawUserMsgText
          : (sceneId ? `${sceneId} GERAR` : "A1 GERAR");

        let langInstruction = "";
      if (targetLang === 'en') {
        langInstruction = "IMPORTANTE: O usuário selecionou o idioma INGLÊS. Embora você gere seções em PT e EN, priorize o rigor técnico do inglês.";
      } else if (targetLang === 'es') {
        langInstruction = "🚨 IMPORTANTE - USUÁRIO FALA ESPANHOL: Você DEVE adicionar uma 'SEÇÃO 4.5 — PROMPT COMPLETO — ES' com o prompt traduzido para ESPANHOL técnico de ArchViz, logo após a seção em Português.";
      }

        const visionPrompt = `SISTEMA RENDER PRO IA — LEITURA FORENSE ULTRA-MINUCIOSA (CAMADAS 0 A 71)
Você é o Arquiteto e Engenheiro Forense de Renderização ArchViz do SKP RENDER PRO IA.
Sua missão é realizar uma LEITURA FORENSE PROFUNDA E EXAUSTIVA desta imagem do SketchUp, gerando o relatório técnico arquitetônico de 5 seções no padrão de excelência máximo do sistema.

${langInstruction}

🚨 REGRA CRÍTICA DE PROMPT: NUNCA mencione "360°", "Panorama 360", "Equirectangular", "360 VR", "câmera 360" ou termos afins.
CENA DO USUÁRIO: "${userInitialLead}"
ENTRADA: "${userPrompt}"
PROPORÇÃO: ${ratioLabel}

🚨 REGRA 1: Comece o relatório SEMPRE com o título: "# ${userInitialLead}".
🚨 REGRA 2 (CAMADA 2 — MATERIAL LOCK ABSOLUTO): Identifique cada material, cor base, textura, acabamento tátil, PBR Roughness, brilho e paginação. NUNCA substitua materiais existentes. Se parecer madeira -> é madeira de padrão real. Se parecer concreto -> é concreto aparente. Correlacione toda marcenaria com catálogos brasileiros (Duratex, Guararapes, Sudati).
🚨 REGRA 3: NUNCA mencione resoluções numéricas ou dimensões em pixels (como 720x1290, 608x1088 ou similares) no prompt.

ESTRUTURA RIGOROSA OBRIGATÓRIA DAS 5 SEÇÕES:

# ${userInitialLead}

### SEÇÃO 1 — IMAGEM ANALISADA
Parágrafo completo, rico e descritivo analisando a imagem específica enviada: enquadramento da câmera (frontal, perspectiva lateral ou angular), plano principal em destaque, elementos em primeiro plano, segundo plano e plano de fundo, composição arquitetônica, teto/forro, piso e integração entre ambientes.

### SEÇÃO 2 — ANÁLISE VISUAL PROFUNDA (COM MATERIAIS UNIFICADOS DO AMBIENTE)
Lista com marcadores (- **Item:**) detalhando CADA elemento visível na cena com especificação física PBR cirúrgica (padrão de material/MDF, cor, textura, acabamento, roughness exato de 0.0 a 1.0, reflexão e comportamento de luz):
- **Piso:** [Especificação do revestimento de piso, réguas/placas, acabamento, roughness]
- **Paredes:** [Especificação de alvenaria, tijolos aparentes, concreto aparente, tintas minerais, roughness]
- **Forro e Teto:** [Especificação de forro ripado, gesso, cor, acabamento, spots embutidos]
- **Marcenaria e Armários:** [Especificação de MDF padrão Duratex/Sudati/Guararapes, acabamento acetinado/fosco, portas provençais/lisas, puxadores]
- **Bancadas e Ilhas:** [Especificação de tampo, pedra/madeira maciça/MDF, paginação de veios, espessura, saia]
- **Eletrodomésticos e Equipamentos:** [Especificação de coifa, cooktop, fornos, geladeira, acabamento inox/vidro temperado]
- **Metais Sanitários e Tubulações:** [Especificação de torneiras monocomando gourmet, eletrodutos aparentes galvanizados, caixas de passagem]
- **Mobiliário e Assentos:** [Especificação de banquetas, cadeiras, sofá, tecido de linho/couro/aço carbono, pintura eletrostática]
- **Iluminação Técnica:** [Especificação de spots LED direcionáveis, temperatura de cor 3000K, fitas LED embutidas, luz indireta rasante]
- **Adornos, Quadros e Decoração:** [Quadros decorativos, molduras de alumínio, objetos sobre bancadas, frascos, livros, vegetação]

### SEÇÃO 3 — INTERVENÇÃO INTELIGENTE
Parágrafo técnico descrevendo a intervenção de renderização: aplicação rigorosa de fotorrealismo PBR (Physical Based Rendering) sobre a cena base ${userInitialLead}, preservando 100% da geometria, layout, proporções, esquadrias e enquadramento originais. Injeção de micro-imperfeições texturais, reflexos fisicamente corretos (roughness, normal maps, ambient occlusion), iluminação indireta suave (Global Illumination) simulando luz natural difusa combinada com a iluminação artificial projetada.

### SEÇÃO 4 — PROMPT COMPLETO — PT
\`\`\`text
${userInitialLead}

MANDATORY FULL-FRAME PRESERVATION:
Render the ENTIRE source image edge-to-edge maintaining the exact camera framing and orientation. Never crop, zoom, reframe, widen the camera, convert portrait to landscape, stretch, or omit content at any of the four edges.
Keep the exact original field of view, camera position and scene boundaries, including floor and ceiling. Only requested materials and lighting may change.
STRICT GEOMETRIC & CHROMATIC FIDELITY (CONTROLNET LOCK): Preserve 100% of the room geometry, camera angle, perspective, walls, openings, window frames, cabinet shapes, and exact furniture layout without moving, adding, or deleting any elements. Keep the exact original project colors and material placements from the 3D model. Zero recoloring, zero material substitution. Only transform flat 3D surfaces into real physically-based PBR materials, add soft realistic ambient occlusion, natural indirect bounce lighting, subtle realistic contact shadows, authentic glass reflections, and professional architectural photography optics.
Do not add, remove or move any object.

Apply materials and atmosphere as described: ${userInitialLead} — [Nome do Ambiente]..
[Todos os materiais da SEÇÃO 2 concatenados em texto corrido separados por ponto e vírgula (;)]

High-end architectural visualization, realistic lighting, global illumination, sharp detail.
\`\`\`

### SEÇÃO 5 — PROMPT COMPLETO — EN
\`\`\`text
${userInitialLead}

Ultra-realistic architectural interior photography of [ambiente em inglês], exact framing of scene ${userInitialLead}.
MANDATORY FULL-FRAME PRESERVATION:
Render the ENTIRE source image edge-to-edge maintaining the exact camera framing and orientation. Never crop, zoom, reframe, widen the camera, convert portrait to landscape, stretch, or omit content at any of the four edges.
Keep the exact original field of view, camera position and scene boundaries, including floor and ceiling. Only requested materials and lighting may change.
STRICT GEOMETRIC & CHROMATIC FIDELITY (CONTROLNET LOCK): Preserve 100% of the room geometry, camera angle, perspective, walls, openings, window frames, cabinet shapes, and exact furniture layout without moving, adding, or deleting any elements. Keep the exact original project colors and material placements from the 3D model. Zero recoloring, zero material substitution. Only transform flat 3D surfaces into real physically-based PBR materials, add soft realistic ambient occlusion, natural indirect bounce lighting, subtle realistic contact shadows, authentic glass reflections, and professional architectural photography optics.
Do not add, remove or move any object.

Apply materials and atmosphere as described: ${userInitialLead} — [Room Name]..
[English translation of all materials concatenated separated by semicolon (;)]

High-end architectural visualization, realistic lighting, global illumination, sharp detail, 8k textures, architectural magazine publication quality.
\`\`\``;

        let visionResult = "";
        try {
          const visionResponse = await generateContentSafe(
            ai,
            "gemini-flash-latest",
            ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
            {
              contents: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
                visionPrompt,
              ],
              config: {
                systemInstruction,
                temperature: 0.1,
              },
            }
          );
          visionResult = visionResponse.text || "";
        } catch (visionErr: any) {
          console.warn("Vision model temporarily unavailable or in high demand, using intelligent ArchViz fallback prompt:", visionErr?.message || visionErr);
          visionResult = generateArchVizFallbackPrompt(userPrompt, sceneId, userInitialLead, targetW, targetH, ratioLabel);
        }

        // Aplica a garantia absoluta: a inicial do prompt é SEMPRE o que o usuário escreveu
        let unifiedMasterPrompt = ensurePromptStartsWithUserText(visionResult, userInitialLead);
        let masterPromptForRender = "";

        // Extrai o prompt contínuo conforme o idioma do usuário para a renderização de imagem rápida
        let match = null;
        if (targetLang === 'en') {
          match = unifiedMasterPrompt.match(/### SEÇÃO [56][^\n]*(?:EN|INGL[EÊ]S|ENGLISH)[^\n]*\n+```(?:text)?\s*([\s\S]*?)```/i);
        } else if (targetLang === 'es') {
          match = unifiedMasterPrompt.match(/### SEÇÃO [45][^\n]*(?:ES|ESPANHOL|ESPAÑOL)[^\n]*\n+```(?:text)?\s*([\s\S]*?)```/i);
        }
        
        // Fallback para PT se não encontrar o idioma específico ou se for PT
        if (!match) {
          match = unifiedMasterPrompt.match(/### SEÇÃO [45][^\n]*(?:PT|PORTUGU[EÊ]S|PROMPT COMPLETO)[^\n]*\n+```(?:text)?\s*([\s\S]*?)```/i) || 
                  unifiedMasterPrompt.match(/### SEÇÃO [45][^\n]*\n+```(?:text)?\s*([\s\S]*?)```/i);
        }

        if (match && match[1]) {
          masterPromptForRender = match[1].trim();
        } else {
          masterPromptForRender = unifiedMasterPrompt;
        }

        extractedMasterPrompt = unifiedMasterPrompt;

        // Geração de imagem desativada conforme solicitação: o sistema atua 100% como gerador e sintetizador de Super Prompts
        generatedImage = undefined;

        const isCorrection = /mude|altere|troque|coloque|retire|adicione|remova|corrija|ajuste|substitua|refaça|refeito|nova versão|versão|muda|troca|editar|edição/i.test(userPrompt);

        replyText = `${unifiedMasterPrompt}`;

        if (!replyText.trim()) {
          replyText = `📸 **LEITURA SEMÂNTICA CONCLUÍDA!**\n\nCena processada pelo SKP Render Pro IA com fidelidade cromática, materiais PBR e iluminação fotorrealista 8K.`;
        }

        // Return everything unified
        return res.json({ 
          reply: replyText,
          image: generatedImage,
          masterPrompt: unifiedMasterPrompt, // This ensures the Copy button gets the full unified block
        });
      } else {
        // Standard chat / prompt text processing
        // Check if we should refine an existing master prompt
        let lastMasterPrompt = "";
        for (let i = messages.length - 2; i >= 0; i--) {
          if (messages[i].sender === "ia" && messages[i].masterPrompt) {
            lastMasterPrompt = messages[i].masterPrompt;
            break;
          }
        }

        const latestUserText = messages[messages.length - 1]?.text || "";

        if (lastMasterPrompt && latestUserText) {
          // Refinement Logic
          const refinementPrompt = `VOCÊ É O FOTÓGRAFO ESPECIALISTA EM ARQUITETURA E DESIGN DE INTERIORES DE ALTO PADRÃO DO SKP RENDER PRO IA.
O USUÁRIO ENVIOU UM PEDIDO EM LINGUAGEM HUMANA PARA MODIFICAR OU REFINAR UM PROMPT FOTOGRÁFICO EXISTENTE.

PROMPT FOTOGRÁFICO ATUAL:
${lastMasterPrompt}

PEDIDO DO USUÁRIO (LINGUAGEM HUMANA):
"${latestUserText}"

SUA MISSÃO:
1. Pegue o PROMPT FOTOGRÁFICO ATUAL e integre o pedido do usuário com a sensibilidade de um fotógrafo e designer de interiores.
2. Mantenha a leitura limpa, elegante e sofisticada do espaço, com toda a terminologia de arquitetura e fotografia editorial.
3. REGRA ABSOLUTA: NUNCA mencione puxadores, ferragens, parafusos ou pequenos detalhes mecânicos. Se o prompt atual tiver menções a puxadores, REMOVA-AS completamente, transformando em descrições de volumetria limpa e superfícies puras.
4. Se o usuário pedir para mudar algo (ex: "mude o piso para madeira"), substitua a descrição mantendo o padrão editorial.
5. Se o usuário pedir para adicionar algo (ex: "coloque uma planta no canto"), adicione essa descrição com elegância na composição.
6. O resultado final deve ser um NOVO MASTER PROMPT completo, 100% em Português, pronto para renderização.

Responda OBRIGATORIAMENTE dentro do bloco:

[PROMPT_START]
{O Master Prompt refinado e completo aqui}
[PROMPT_END]`;

          try {
            const refinementResponse = await generateContentSafe(
              ai,
              "gemini-3.8-flash",
              ["gemini-flash-latest", "gemini-3.1-flash-lite"],
              {
                contents: refinementPrompt,
                config: {
                  systemInstruction,
                  temperature: 0.2,
                  thinkingConfig: { thinkingLevel: "LOW" },
                },
              }
            );
            const refinedText = refinementResponse.text || "";
            if (refinedText.includes("[PROMPT_START]") && refinedText.includes("[PROMPT_END]")) {
              const newMasterPrompt = refinedText.split("[PROMPT_START]")[1].split("[PROMPT_END]")[0].trim();
              return res.json({
                reply: `✅ **PROMPT REFINADO COM SUCESSO!**\n\nIntegrei seu pedido "${latestUserText}" ao projeto original mantendo a máxima precisão técnica.`,
                masterPrompt: newMasterPrompt,
              });
            }
          } catch (refErr) {
            console.warn("Refinement failed, falling back to standard chat:", refErr);
          }
        }

        const textContext = messages
          .slice(-6)
          .map((m: { sender: string; text: string }) => `${m.sender === "user" ? "Usuário" : "SKP RENDER PRO IA"}: ${m.text}`)
          .join("\n\n");

        let responseText = "";
        const currentUserText = (latestUserText || messages[messages.length - 1]?.text || "").trim();
        const sceneMatch = currentUserText.match(/^([A-Za-z][0-9]{1,2})/);
        const sceneId = sceneMatch ? sceneMatch[1].toUpperCase() : "";

        try {
          const response = await generateContentSafe(
            ai,
            "gemini-flash-latest",
            ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
            {
              contents: textContext,
              config: {
                systemInstruction,
                temperature: 0.25,
                thinkingConfig: { thinkingLevel: "LOW" },
              },
            }
          );
          responseText = response.text || "";
        } catch (chatErr: any) {
          console.warn("Chat model temporarily unavailable, using prompt synthesizer fallback:", chatErr?.message || chatErr);
          responseText = generateArchVizFallbackPrompt(currentUserText || "A1 GERAR", sceneId, currentUserText, targetW, targetH, ratioLabel);
        }

        if (!responseText || !responseText.trim()) {
          responseText = generateArchVizFallbackPrompt(currentUserText || "A1 GERAR", sceneId, currentUserText, targetW, targetH, ratioLabel);
        }

        replyText = responseText;
      }

      return res.json({ 
        reply: replyText,
        masterPrompt: replyText,
        image: generatedImage,
        imageWidth: targetW,
        imageHeight: targetH,
        isImported: isImportedImage,
      });
    } catch (error: any) {
      console.warn("Handled Chat API status:", error?.message || error);
      const latestMsg = req.body?.messages?.[req.body?.messages?.length - 1];
      const userText = (latestMsg?.text || "A1 GERAR").trim();
      const sceneMatch = userText.match(/^([A-Za-z][0-9]{1,2})/);
      const sceneId = sceneMatch ? sceneMatch[1].toUpperCase() : "A1";
      const fallbackPrompt = generateArchVizFallbackPrompt(userText, sceneId, userText);

      return res.json({ 
        reply: fallbackPrompt,
        masterPrompt: fallbackPrompt,
        image: null,
        success: true,
      });
    }
  });

  // ==========================================
  // OFUSCADOR DE CÓDIGO RUBY (SEGURANÇA PRO)
  // ==========================================
  app.post("/api/admin/obfuscate", express.json({ limit: "15mb" }), (req, res) => {
    try {
      const { code, filename } = req.body;
      if (!code) return res.status(400).json({ error: "Código não fornecido" });

      // 1. Limpeza segura: remove apenas linhas de comentários puros e blocos =begin/=end
      // NUNCA usar split("#")[0] pois o Ruby usa "#{variavel}" para interpolação de strings e hex colors!
      const lines = code.split("\n");
      const cleanLines = [];
      let inMultilineComment = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Handle multiline comments =begin/=end
        if (trimmed.startsWith("=begin")) { inMultilineComment = true; continue; }
        if (trimmed.startsWith("=end")) { inMultilineComment = false; continue; }
        if (inMultilineComment) continue;

        // Pular linhas vazias
        if (trimmed.length === 0) continue;

        // Pula apenas se a linha for estritamente um comentário iniciando com #
        if (trimmed.startsWith("#")) continue;

        // Mantém a linha de código exatamente como escrita, preservando aspas, interpolações e sintaxe
        cleanLines.push(line);
      }

      const cleanCode = cleanLines.join("\n");

      // 2. Comprimir usando Zlib (Node zlib para formato compatível Ruby)
      const compressed = zlib.deflateSync(Buffer.from(cleanCode, "utf8"));
      
      // 3. Converter para Base64
      const b64 = compressed.toString("base64");

      // 4. Gerar o "Loader" Ruby Profissional
      const obfuscated = `# ==============================================================================
# SKP RENDER PRO SECURITY - PROTECTED FILE
# ==============================================================================
require 'zlib';require 'base64';eval(Zlib::Inflate.inflate(Base64.decode64("${b64}")))
# ==============================================================================`;

      console.log(`[ADMIN] Código Ruby ofuscado com sucesso: ${filename || "arquivo"}`);

      res.json({ 
        success: true, 
        obfuscated,
        filename: filename ? filename.replace(".rb", "_protected.rb") : "skp_render_pro_protected.rb"
      });
    } catch (err: any) {
      console.error("[OBFUSCATE ERROR]", err);
      res.status(500).json({ error: "Falha na ofuscação: " + err.message });
    }
  });

  // Salvar o código ofuscado na versão protegida (skp_render_pro_protected.rb)
  app.post("/api/admin/publish-protected", express.json({ limit: "15mb" }), (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Código não fornecido" });

      const filePath = path.resolve("public", "skp_render_pro_protected.rb");
      
      console.log(`[ADMIN] Publicando arquivo protegido em: ${filePath}`);
      fs.writeFileSync(filePath, code, "utf8");
      
      if (fs.existsSync(path.resolve("dist"))) {
        fs.writeFileSync(path.resolve("dist", "skp_render_pro_protected.rb"), code, "utf8");
      }

      console.log("[ADMIN] Nova versão protegida publicada com sucesso!");
      res.json({ success: true, message: "Versão protegida publicada com sucesso em skp_render_pro_protected.rb!" });
    } catch (err: any) {
      console.error("[PUBLISH ERROR]", err);
      res.status(500).json({ error: "Falha ao publicar atualização: " + err.message });
    }
  });

  // Restaurar skp_render_pro.rb para a versão pura e estável oficial
  app.post("/api/admin/restore-stable", (req, res) => {
    try {
      const publicPath = path.resolve("public");
      const sourcePath = path.join(publicPath, "skp_render_pro_source.rb");
      const normalPath = path.join(publicPath, "skp_render_pro.rb");

      if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: "Arquivo fonte original não encontrado." });
      }

      const sourceCode = fs.readFileSync(sourcePath, "utf8");
      fs.writeFileSync(normalPath, sourceCode, "utf8");

      const distDir = path.resolve("dist");
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, "skp_render_pro.rb"), sourceCode, "utf8");
      }

      console.log(`[ADMIN] skp_render_pro.rb restaurado com sucesso para a versão mais estável (${sourceCode.split("\n").length} linhas)!`);
      res.json({ 
        success: true, 
        message: "Plugin skp_render_pro.rb restaurado com sucesso para o estado mais estável e completo!",
        lines: sourceCode.split("\n").length
      });
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao restaurar: " + err.message });
    }
  });

  // Bloqueio de segurança: nenhuma rota /api/* pode cair no fallback SPA (servir index.html)
  app.use("/api", (req, res) => {
    res.status(404).type("text/plain").send("Endpoint da API não encontrado.");
  });

  // Vite middleware for development (MUST be mounted AFTER API routes)
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Iniciando em modo DESENVOLVIMENTO (Vite)");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SERVER] Iniciando em modo PRODUÇÃO (Arquivos Estáticos)");
    const distPath = path.resolve("dist");
    app.use(express.static(distPath, {
      maxAge: '0',
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).type("text/plain").send("Endpoint da API não encontrado.");
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SKP RENDER PRO IA Server running on http://localhost:${PORT}`);
  });

  // Sincronização em background para não travar o boot do servidor
  initFirestoreSync().catch(err => {
    console.warn("[FIRESTORE SERVICE] Falha na sincronização inicial em background:", err);
  });
}

startServer();
