import re

# 1. Update server.ts
with open("server.ts", "r", encoding="utf-8") as f:
    server_code = f.read()

# Replace if (is360) block in generateArchVizFallbackPrompt
old_fallback_part = re.search(r'function generateArchVizFallbackPrompt\(userPrompt: string, sceneId: string, userInitialLead = "", targetW = 2000, targetH = 2500, ratioLabel = "4:5 \(Feed do Instagram\)"\): string \{[\s\S]*?return `# \$\{lead\}\n\n### SEÇÃO 1 — IMAGEM ANALISADA', server_code)
if old_fallback_part:
    new_fallback_part = '''function generateArchVizFallbackPrompt(userPrompt: string, sceneId: string, userInitialLead = "", targetW = 2000, targetH = 2500, ratioLabel = "4:5 (Feed do Instagram)"): string {
  const lead = (userInitialLead || (sceneId ? `${sceneId} GERAR` : "A1 GERAR")).trim();
  const cleanedPrompt = userPrompt
    .replace(/^[A-Za-z][0-9]{1,2}\\s*(GERAR\\s*-?)?/i, "")
    .replace(/\\b(?:360[°º]?|VR|equirretangular|equirectangular)\\b/gi, "")
    .trim() || "Reconstrução fiel / Fidelidade arquitetônica absoluta sem alterações de elementos.";

  return `# ${lead}

### SEÇÃO 1 — IMAGEM ANALISADA'''
    server_code = server_code.replace(old_fallback_part.group(0), new_fallback_part)
    print("✓ Replaced fallback prompt")
else:
    print("✕ Could not find fallback prompt")

# Update ratioLabel in server.ts
old_ratio_block = """      const ratioLabel = is360
        ? `Panorama 360° VR Equirretangular 2:1 (${targetW}x${targetH} px - ULTRA HD 8K - RESOLUÇÃO MÁXIMA)`
        : (isImportedImage 
          ? `Dimensão Nativa (${targetW}x${targetH})` 
          : (targetR === 0.8 ? '4:5 (Feed do Instagram)' : targetR === 0.5625 ? '9:16 (Stories / Reels)' : targetR === 1 ? '1:1 (Quadrado)' : targetR === 1.777 ? '16:9 (Cinematográfico / Panorâmico)' : `${targetW}:${targetH}`));"""

new_ratio_block = """      const ratioLabel = is360
        ? `2:1 (Panorâmico ${targetW}x${targetH} px)`
        : (isImportedImage 
          ? `Dimensão Nativa (${targetW}x${targetH})` 
          : (targetR === 0.8 ? '4:5 (Feed do Instagram)' : targetR === 0.5625 ? '9:16 (Stories / Reels)' : targetR === 1 ? '1:1 (Quadrado)' : targetR === 1.777 ? '16:9 (Cinematográfico / Panorâmico)' : `${targetW}:${targetH}`));"""
if old_ratio_block in server_code:
    server_code = server_code.replace(old_ratio_block, new_ratio_block)
    print("✓ Replaced ratioLabel")
else:
    print("✕ Could not find ratioLabel")

# Update userPrompt default in server.ts
old_user_prompt = """        const userPrompt = lastMsg?.text || (is360
          ? "Renderização panorâmica esférica 360° VR (Equirretangular 2:1) na MAIOR RESOLUÇÃO POSSÍVEL em Ultra HD 8K (8000x4000 pixels), com nitidez fotográfica máxima, costura 360 perfeita (seamless wrap-around), materiais PBR de altíssima definição, iluminação global realista e fidelidade absoluta à arquitetura do modelo 3D."
          : (isImportedImage ? "Renderize esta imagem importada em uma fotografia arquitetônica real e indistinguível de uma obra construída, mantendo a perspectiva original e texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista." : "Transforme este print 3D do SketchUp em uma fotografia arquitetônica real e indistinguível de uma foto de obra construída, mantendo a posição exata da câmera, o layout do projeto e as texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista."));"""

new_user_prompt = """        const userPrompt = lastMsg?.text || (isImportedImage 
          ? "Renderize esta imagem importada em uma fotografia arquitetônica real e indistinguível de uma obra construída, mantendo a perspectiva original e texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista." 
          : "Transforme este print 3D do SketchUp em uma fotografia arquitetônica real e indistinguível de uma foto de obra construída, mantendo a posição exata da câmera, o layout do projeto e as texturas base, aplicando materiais PBR fisicamente corretos, iluminação global e atmosfera fotorrealista.");"""

if old_user_prompt in server_code:
    server_code = server_code.replace(old_user_prompt, new_user_prompt)
    print("✓ Replaced userPrompt default")
else:
    print("✕ Could not find userPrompt default")

# Update visionPrompt 360 directive in server.ts
old_vision_360 = "${is360 ? `🚨 360° VR MÁXIMA (8000x4000): Panorama Equirretangular 2:1. Incluir obrigatoriamente: \"[GERAR NA MAIOR RESOLUÇÃO POSSÍVEL: 8000x4000 PIXELS ULTRA HD 8K]\".` : ''}"
new_vision_360 = "🚨 REGRA CRÍTICA DE PROMPT: NUNCA mencione \"360°\", \"Panorama 360\", \"Equirectangular\", \"360 VR\", \"câmera 360\" ou termos afins nos prompts. Descreva estritamente fotografia arquitetônica de alta fidelidade com lente de arquitetura e perspectiva alinhada."

if old_vision_360 in server_code:
    server_code = server_code.replace(old_vision_360, new_vision_360)
    print("✓ Replaced visionPrompt 360 directive")
else:
    print("✕ Could not find visionPrompt 360 directive")

# Update imageGenPrompt in server.ts
old_image_gen = """        const imageGenPrompt = is360
          ? `${masterPromptForRender}\\n\\n[DIRETRIZ SUPREMA DE RENDERIZAÇÃO 360° VR]: GERAR O RENDER NA MAIOR RESOLUÇÃO POSSÍVEL em Ultra HD 8K (8000x4000 pixels). Formato Panorama Equirretangular 360° x 180° esférico (proporção 2:1). Costura 360 perfeita (seamless wrap-around) sem emendas entre as bordas laterais. Câmera nivelada a 1,60m. Fidelidade absoluta aos materiais PBR e à arquitetura do modelo 3D. Espelhos e reflexos com fidelidade total de cores reais e naturais da cena (plantas verdes, madeiras, objetos coloridos), sem reflexos desbotados ou monocromáticos. ${userPrompt}`
          : `${masterPromptForRender}\\n\\n[DIRETRIZES FOTOGRÁFICAS ESTRITAS]: Trava absoluta de câmera, enquadramento e perspectiva 1:1 à imagem 3D de referência. Preservar rigorosamente o layout e cores/texturas base. Aplicar materiais PBR em cada objeto, iluminação global ray-traced e sombras de contato para padrão fotográfico 100% real. [FIDELIDADE CROMÁTICA DE REFLEXOS]: Espelhos, vidros e pisos polidos devem refletir a cena com total fidelidade de cores vivas e naturais (vegetação verde, madeira quente, livros e decorações coloridas), terminantemente proibido reflexos preto-e-branco ou monocromáticos. ${userPrompt}`;"""

new_image_gen = """        const imageGenPrompt = `${masterPromptForRender}\\n\\n[DIRETRIZES FOTOGRÁFICAS ESTRITAS]: Trava absoluta de câmera, enquadramento e perspectiva 1:1 à imagem 3D de referência. Preservar rigorosamente o layout e cores/texturas base. Aplicar materiais PBR em cada objeto, iluminação global ray-traced e sombras de contato para padrão fotográfico 100% real. [FIDELIDADE CROMÁTICA DE REFLEXOS]: Espelhos, vidros e pisos polidos devem refletir a cena com total fidelidade de cores vivas e naturais (vegetação verde, madeira quente, livros e decorações coloridas), terminantemente proibido reflexos preto-e-branco ou monocromáticos. ${userPrompt}`;"""

if old_image_gen in server_code:
    server_code = server_code.replace(old_image_gen, new_image_gen)
    print("✓ Replaced imageGenPrompt")
else:
    print("✕ Could not find imageGenPrompt")

# Add 360 cleaner to ensurePromptStartsWithUserText
old_cleaner = """  // 4. Remover terminantemente SEÇÃO 6 — IMAGE READING JSON e blocos JSON no final
  result = result.replace(/(\\n*---\\s*)?\\n*### SEÇÃO 6[\\s\\S]*$/i, "").trim();
  result = result.replace(/(\\n*---\\s*)?\\n*### [^\\n]*IMAGE READING JSON[\\s\\S]*$/i, "").trim();
  result = result.replace(/\\n+```json[\\s\\S]*?```\\s*$/i, "").trim();"""

new_cleaner = """  // 4. Remover terminantemente SEÇÃO 6 — IMAGE READING JSON e blocos JSON no final
  result = result.replace(/(\\n*---\\s*)?\\n*### SEÇÃO 6[\\s\\S]*$/i, "").trim();
  result = result.replace(/(\\n*---\\s*)?\\n*### [^\\n]*IMAGE READING JSON[\\s\\S]*$/i, "").trim();
  result = result.replace(/\\n+```json[\\s\\S]*?```\\s*$/i, "").trim();

  // 5. Remover qualquer termo residual de 360, VR e equirretangular dos prompts gerados
  result = result.replace(/\\[\\s*(?:GERAR NA MAIOR RESOLUÇÃO POSSÍVEL|MANDATORY MAXIMUM RESOLUTION)?[^\\]]*8000x4000[^\\]]*\\]\\s*/gi, "");
  result = result.replace(/(?:Panorama\\s+)?(?:Equirretangular|Equirectangular)\\s*(?:esférico\\s*)?(?:360[°º]?\\s*(?:x\\s*180[°º]?)?)?(?:\\s*\\(proporção 2:1\\)|\\s*\\(2:1 aspect ratio\\))?/gi, "Fotografia arquitetônica");
  result = result.replace(/\\b360[°º]?\\s*(?:VR|esféric[oa]|graus)?\\b/gi, "");
  result = result.replace(/\\bseamless\\s+wrap-around\\b/gi, "");
  result = result.replace(/\\bcostura\\s+(?:360\\s+)?contínua\\s+perfeita\\b/gi, "");
  result = result.replace(/\\bcâmera\\s+360[°º]?\\b/gi, "câmera");"""

if old_cleaner in server_code:
    server_code = server_code.replace(old_cleaner, new_cleaner)
    print("✓ Added 360 cleaner to ensurePromptStartsWithUserText")
else:
    print("✕ Could not find old_cleaner")

with open("server.ts", "w", encoding="utf-8") as f:
    f.write(server_code)

# 2. Update src/App.tsx line 2210
with open("src/App.tsx", "r", encoding="utf-8") as f:
    app_code = f.read()

old_app_360 = "setInput('A1 GERAR - [GERAR NA MAIOR RESOLUÇÃO POSSÍVEL: 8000x4000 PIXELS ULTRA HD 8K] Panorama arquitetônico equirretangular esférico 360° x 180° (proporção 2:1) de altíssimo padrão, na MAIOR RESOLUÇÃO POSSÍVEL em Ultra HD 8K (8000x4000 pixels), costura 360 contínua perfeita (seamless wrap-around), materiais PBR de altíssima definição, iluminação global realista e fidelidade absoluta à arquitetura do modelo 3D.');"
new_app_360 = "setInput('A1 GERAR - Fotografia arquitetônica profissional editorial de interiores, mantendo rigorosamente a geometria, enquadramento e perspectiva do modelo 3D, com materiais PBR de altíssima definição, iluminação global realista e fidelidade absoluta à arquitetura.');"

if old_app_360 in app_code:
    app_code = app_code.replace(old_app_360, new_app_360)
    print("✓ Replaced input text in src/App.tsx")
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(app_code)
else:
    print("✕ Could not find old_app_360 in src/App.tsx")

# 3. Update src/data/commandSlots.ts slot_28
with open("src/data/commandSlots.ts", "r", encoding="utf-8") as f:
    slots_code = f.read()

old_slot_28 = """  {
    id: "slot_28",
    label: "C8: Render 360 Panorâmico para Óculos VR",
    prompt: "C8 GERAR - Como configurar a câmera esférica 360 no SketchUp e exportar com metadados para tour virtual interativo.",
  },"""

new_slot_28 = """  {
    id: "slot_28",
    label: "C8: Perspectiva Ampla Panorâmica 2:1",
    prompt: "C8 GERAR - Como configurar a câmera grande angular de arquitetura no SketchUp para composição ampla sem distorções esféricas nas bordas.",
  },"""

if old_slot_28 in slots_code:
    slots_code = slots_code.replace(old_slot_28, new_slot_28)
    print("✓ Replaced slot_28 in commandSlots.ts")
    with open("src/data/commandSlots.ts", "w", encoding="utf-8") as f:
        f.write(slots_code)
else:
    print("✕ Could not find slot_28 in commandSlots.ts")

# 4. Update src/components/Panorama360Modal.tsx
with open("src/components/Panorama360Modal.tsx", "r", encoding="utf-8") as f:
    modal_code = f.read()

modal_code = modal_code.replace("Usar no Prompt / Renderizar 360° (8K)", "Usar Imagem no Prompt / Renderizar")
modal_code = modal_code.replace("Usar este 360 no Render (8K)", "Usar Imagem no Render")
with open("src/components/Panorama360Modal.tsx", "w", encoding="utf-8") as f:
    f.write(modal_code)
print("✓ Updated Panorama360Modal.tsx")
