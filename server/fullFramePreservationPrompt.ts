/**
 * SKP Render Pro IA — Bloco Mestre de Preservação Obrigatória de Enquadramento Total
 * MANDATORY FULL-FRAME PRESERVATION & EXHAUSTIVE SCENE DESCRIPTION
 */

export const MANDATORY_FULL_FRAME_PRESERVATION_TEMPLATE = `STRICT FLAT RECTILINEAR PROJECTION LOCK (HIGHEST PRIORITY): Absolutely NO 360-degree panorama, NO spherical wrap, NO fish-eye effect, NO wall curving, NO equirectangular projection, NO 2:1 ratio panorama. Standard architectural perspective photography with straight vertical lines and normal flat rectilinear lens projection. This is a standard 2D perspective photo render of a single interior/exterior view, NOT a 360 panorama.

MANDATORY FULL-FRAME PRESERVATION:
Render the ENTIRE source image edge-to-edge maintaining the exact camera framing and orientation. Never crop, zoom, reframe, widen the camera, convert portrait to landscape, stretch, or omit content at any of the four edges.
Keep the exact original field of view, camera position and scene boundaries, including floor and ceiling. Only requested materials and lighting may change.

STRICT GEOMETRIC & CHROMATIC FIDELITY (CONTROLNET LOCK): Preserve 100% of the room geometry, camera angle, perspective, walls, openings, window frames, cabinet shapes, and exact furniture layout without moving, adding, or deleting any elements. Keep the exact original project colors and material placements from the 3D model. Zero recoloring, zero material substitution. Only transform flat 3D surfaces into real physically-based PBR materials, add soft realistic ambient occlusion, natural indirect bounce lighting, subtle realistic contact shadows, authentic glass reflections, and professional architectural photography optics.
Do not add, remove or move any object.

EXHAUSTIVE DETAILED SCENE & MATERIAL DESCRIPTION (FORENSIC ARCHVIZ):
Apply ultra-high definition PBR physical properties and forensic detail to every element in the scene:
1. FLOORING & PAVING: Continuous oak wood planks or large-format porcelain tiles with natural grain, microscopic surface pores, subtle tactile roughness (0.40), clean micro-chamfered joints, and natural light absorption.
2. BESPOKE JOINERY & CABINETRY: High-end millwork with continuous organic wood veneer and matte anti-touch lacquer, crisp 0.2mm edge highlights, precise reveals, and soft-closing hardware details.
3. WALLS & CEILINGS: Architectural mineral wall paint with a velvety matte tactile finish (roughness 0.85), flawless gypsum ceiling planes with acoustic smoothness.
4. METALS & HARDWARE: Brushed satin stainless steel and micro-textured matte black aluminum frames with anisotropic brush lines and subtle specular highlights.
5. GLASS & REFLECTIONS: High-transparency architectural glass with realistic Fresnel reflections, subtle environmental refraction, and clean edge chamfers.
6. LIGHTING & ATMOSPHERE: Warm indirect cove lighting (2700K-3000K) casting soft ambient occlusion (AO) in all surface intersections, balanced with diffused daylight, producing deep Z-depth atmospheric realism.
7. BOTANY & DECOR (IF PRESENT): Individual botanical leaves with natural color variation (lime to deep forest green), physical Subsurface Scattering (SSS) translucency, vein highlights, and organic dust particles.

Apply materials and atmosphere as described: [PROMPT DO CLIENTE].
[materiais gerados pelo plugin]

Shot on Hasselblad H6D-100c, 8k resolution, spectral path tracing, physical lens diffusion.`;


export function buildMandatoryFullFramePrompt(
  clientPrompt: string,
  materialsText?: string
): string {
  const promptCliente = clientPrompt?.trim() || 'Fidelidade arquitetônica absoluta / render fotorrealista';
  const materiaisPlugin = materialsText?.trim() || 'Pavimentação contínua com réguas amadeiradas de carvalho natural fosco (roughness 0.45); alvenaria mineral acetinada fosca em tom neutro quente/areia (roughness 0.70); marcenaria sob medida com veios orgânicos contínuos em lâmina natural nobre; forro de gesso liso ultra-fosco aveludado; perfis de alumínio preto fosco microtexturizado; vidros translúcidos com reflexo de fresnel suave; iluminação indireta rasante com fitas de LED 2700K-3000K e luz natural difusa.';

  return MANDATORY_FULL_FRAME_PRESERVATION_TEMPLATE
    .replace('[PROMPT DO CLIENTE]', promptCliente)
    .replace('[materiais gerados pelo plugin]', materiaisPlugin);
}

