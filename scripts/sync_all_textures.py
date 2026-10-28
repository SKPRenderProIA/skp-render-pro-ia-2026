#!/usr/bin/env python3
import os
import re
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "textures", "mdf")
INDEX_FILE = os.path.join(BASE_DIR, "data", "drive_textures_index.json")
CATALOG_FILE = os.path.join(BASE_DIR, "data", "mdf_catalog.json")

ROOT_FOLDER_ID = "1SFBLhpfKdlJpX-iVBY-RxpXpJCLFCKOo"

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

def get_folder_contents(folder_id):
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error fetching {folder_id}: {e}")
        return [], []
    
    pattern = r'aria-label="([^"]+)"[^>]+ssk=[\x27"]5:auSv138:([a-zA-Z0-9_\-]+)-0-16[\x27"]'
    raw_matches = re.findall(pattern, html)
    
    folders = []
    files = []
    
    for label, fid in raw_matches:
        if "Shared folder" in label:
            folder_name = label.replace(" Shared folder", "").strip()
            folders.append((folder_name, fid))
        elif any(ext in label.lower() for ext in ['.jpg', '.jpeg', '.png', '.webp', 'image']):
            file_name = label.replace(" Image Shared", "").replace(" Image", "").strip()
            files.append((file_name, fid))
            
    return folders, files

def crawl_drive(root_id):
    print("Starting recursive crawl of Google Drive folder...")
    all_files = {} # clean_filename -> {id, name, path}
    visited_folders = set()
    queue = [("", root_id, 0)] # (path_prefix, folder_id, depth)

    while queue:
        current_path, current_id, depth = queue.pop(0)
        if current_id in visited_folders or depth > 4:
            continue
        visited_folders.add(current_id)

        print(f"Scanning folder: {current_path or 'ROOT'} (depth {depth})...")
        subfolders, files = get_folder_contents(current_id)

        for fname, fid in files:
            clean_name = fname.strip()
            # Normalize extension
            if not any(clean_name.lower().endswith(e) for e in ['.jpg', '.jpeg', '.png', '.webp']):
                clean_name += ".jpg"
            all_files[clean_name.lower()] = {
                "id": fid,
                "name": clean_name,
                "folder": current_path
            }

        for subname, subid in subfolders:
            sub_path = f"{current_path}/{subname}" if current_path else subname
            queue.append((sub_path, subid, depth + 1))

    print(f"Crawl finished. Found {len(all_files)} total texture files.")
    return all_files

def download_file(file_info, output_dir):
    fname = file_info["name"]
    fid = file_info["id"]
    dest_path = os.path.join(output_dir, fname)

    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        return fname, True, "already_exists"

    url = f"https://drive.usercontent.google.com/download?id={fid}&export=download"
    req = urllib.request.Request(url, headers=HEADERS)

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as response, open(dest_path, "wb") as out_file:
                out_file.write(response.read())
            return fname, True, "downloaded"
        except Exception as e:
            time.sleep(1 + attempt)
            if attempt == 2:
                return fname, False, str(e)

def update_mdf_catalog(downloaded_files):
    if not os.path.exists(CATALOG_FILE):
        return

    with open(CATALOG_FILE, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    # Normalized lookup of available files
    available_map = {}
    for fname in os.listdir(OUTPUT_DIR):
        available_map[fname.lower()] = fname

    matched = 0
    for item in catalog:
        tex_file = item.get("textureFile", "")
        if not tex_file:
            continue
        key = tex_file.lower()
        if key in available_map:
            item["localTexture"] = f"/textures/mdf/{available_map[key]}"
            matched += 1

    with open(CATALOG_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f"Updated catalog: {matched}/{len(catalog)} materials now have local texture previews!")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(INDEX_FILE), exist_ok=True)

    all_files = crawl_drive(ROOT_FOLDER_ID)

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(all_files, f, ensure_ascii=False, indent=2)

    print(f"Saved texture index with {len(all_files)} items to {INDEX_FILE}")

    # Download in parallel using thread pool
    print(f"Downloading textures to {OUTPUT_DIR}...")
    success_count = 0
    failed_count = 0

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download_file, finfo, OUTPUT_DIR): finfo for finfo in all_files.values()}
        for future in as_completed(futures):
            fname, ok, msg = future.result()
            if ok:
                success_count += 1
            else:
                failed_count += 1
            if (success_count + failed_count) % 25 == 0:
                print(f"Progress: {success_count}/{len(all_files)} downloaded ({failed_count} failed)")

    print(f"Download complete: {success_count} succeeded, {failed_count} failed.")
    update_mdf_catalog(all_files)

if __name__ == "__main__":
    main()
