/**
 * SKP Render Pro IA — Bloco Mestre de Preservação Obrigatória de Enquadramento Total
 * MANDATORY FULL-FRAME PRESERVATION
 */

export const MANDATORY_FULL_FRAME_PRESERVATION_TEMPLATE = `MANDATORY FULL-FRAME PRESERVATION:
Render the ENTIRE source image edge-to-edge maintaining the exact camera framing and orientation. Never crop, zoom, reframe, widen the camera, convert portrait to landscape, stretch, or omit content at any of the four edges.
Keep the exact original field of view, camera position and scene boundaries, including floor and ceiling. Only requested materials and lighting may change.
STRICT GEOMETRIC & CHROMATIC FIDELITY (CONTROLNET LOCK): Preserve 100% of the room geometry, camera angle, perspective, walls, openings, window frames, cabinet shapes, and exact furniture layout without moving, adding, or deleting any elements. Keep the exact original project colors and material placements from the 3D model. Zero recoloring, zero material substitution. Only transform flat 3D surfaces into real physically-based PBR materials, add soft realistic ambient occlusion, natural indirect bounce lighting, subtle realistic contact shadows, authentic glass reflections, and professional architectural photography optics.
Do not add, remove or move any object.

Apply materials and atmosphere as described: [PROMPT DO CLIENTE].
[materiais gerados pelo plugin]

High-end architectural visualization, realistic lighting, global illumination, sharp detail.`;


export function buildMandatoryFullFramePrompt(
  clientPrompt: string,
  materialsText?: string
): string {
  const promptCliente = clientPrompt?.trim() || 'Fidelidade arquitetônica absoluta / render fotorrealista';
  const materiaisPlugin = materialsText?.trim() || 'Materiais PBR táteis de alto padrão, texturas autênticas de marcenaria, superfícies naturais e iluminação global realista';

  return MANDATORY_FULL_FRAME_PRESERVATION_TEMPLATE
    .replace('[PROMPT DO CLIENTE]', promptCliente)
    .replace('[materiais gerados pelo plugin]', materiaisPlugin);
}
