#!/usr/bin/env python3
import os
import glob
import json
import xml.etree.ElementTree as ET

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(SCRIPT_DIR)
CATALOGS_DIR = os.path.join(APP_DIR, "data", "catalogs")
OUTPUT_FILE = os.path.join(APP_DIR, "data", "mdf_catalog.json")

def clean_texture_filename(filepath):
    if not filepath:
        return ""
    # Normalize Windows/Unix path separators
    filename = filepath.replace('\\', '/').split('/')[-1]
    return filename

def parse_xml_file(xml_path):
    brand_name = os.path.splitext(os.path.basename(xml_path))[0].replace('_', ' ').title()
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing {xml_path}: {e}")
        return []

    if root.tag == "FOLDER" and root.attrib.get("NAME"):
        brand_name = root.attrib.get("NAME")

    materials = []
    seen_keys = set()

    for mat in root.iter("MATERIAL"):
        mat_id = mat.attrib.get("ID", "")
        name = mat.attrib.get("NAME", "").strip()
        if not name:
            continue

        # Extract Collection / Folder
        collection = ""
        # Find parent folders
        # We can find texture file
        tex_node = mat.find("TEXTUREFILE")
        tex_file = clean_texture_filename(tex_node.text) if (tex_node is not None and tex_node.text) else ""

        # Color
        color_node = mat.find("COLORBASE")
        r, g, b = 200, 200, 200
        hex_color = "#C8C8C8"
        if color_node is not None and "R" in color_node.attrib:
            try:
                r = int(color_node.attrib.get("R", 200))
                g = int(color_node.attrib.get("G", 200))
                b = int(color_node.attrib.get("B", 200))
                hex_color = f"#{r:02X}{g:02X}{b:02X}"
            except:
                pass

        # Roughness & Specular
        roughness_node = mat.find("ROUGHNESS")
        roughness = float(roughness_node.text) if (roughness_node is not None and roughness_node.text) else 0.4

        specular_node = mat.find("SPECULAR")
        specular = float(specular_node.text) if (specular_node is not None and specular_node.text) else 0.05

        mcode_node = mat.find("MCODE")
        mcode = mcode_node.text if (mcode_node is not None and mcode_node.text) else ""

        # Dedup: Many materials have "_hor_" and "_ver_" versions with identical name and color
        clean_name = name.replace(" Horizontal", "").replace(" Vertical", "").strip()
        dedup_key = f"{brand_name}_{clean_name}".lower()

        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        # Classification
        category = "Madeirado"
        lower_name = clean_name.lower()
        lower_mcode = mcode.lower()

        if any(w in lower_name for w in ["branco", "preto", "cinza", "grafite", "azul", "verde", "rosa", "amarelo", "areia", "titan", "titânio", "alecrim", "marsala", "capuccino", "ouro", "terracota", "tijolo", "fendi", "mocca", "panna", "açaí", "cacau", "maracujá", "platina", "turmalina", "ocre"]):
            category = "Unicolor"
        elif any(w in lower_name for w in ["linho", "linum", "tecido", "tela", "tricotê", "trama", "renda", "palha"]):
            category = "Tecido"
        elif any(w in lower_name for w in ["corten", "aço", "cobre", "ônix", "bronze", "metal"]):
            category = "Metálico"
        elif any(w in lower_name for w in ["arenito", "basalto", "marmo", "petra", "quartzo", "pedra", "rocha", "mineral", "vulcano", "granile"]):
            category = "Mineral / Pedra"

        materials.append({
            "id": mat_id,
            "brand": brand_name,
            "name": clean_name,
            "category": category,
            "hexColor": hex_color,
            "rgb": [r, g, b],
            "roughness": roughness,
            "specular": specular,
            "mcode": mcode,
            "textureFile": tex_file
        })

    return materials

def main():
    all_materials = []
    xml_files = sorted(glob.glob(os.path.join(CATALOGS_DIR, "*.xml")))
    print(f"Found {len(xml_files)} catalog XML files.")

    for f in xml_files:
        mats = parse_xml_file(f)
        print(f"Parsed {len(mats)} unique materials from {os.path.basename(f)}")
        all_materials.extend(mats)

    print(f"Total unique materials in database: {len(all_materials)}")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        json.dump(all_materials, out, ensure_ascii=False, indent=2)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
