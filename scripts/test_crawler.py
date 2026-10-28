import urllib.request
import re

def get_folder_contents(folder_id):
    url = f"https://drive.google.com/drive/folders/{folder_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    html = urllib.request.urlopen(req).read().decode("utf-8", errors="ignore")
    
    # Matches aria-label="... Shared folder" or aria-label="... Image Shared"
    # and ssk="5:auSv138:<ID>-0-16"
    pattern = r'aria-label="([^"]+)"[^>]+ssk=[\x27"]5:auSv138:([a-zA-Z0-9_\-]+)-0-16[\x27"]'
    raw_matches = re.findall(pattern, html)
    
    folders = []
    files = []
    
    for label, fid in raw_matches:
        if "Shared folder" in label:
            folder_name = label.replace(" Shared folder", "").strip()
            folders.append((folder_name, fid))
        elif "Image Shared" in label or label.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            file_name = label.replace(" Image Shared", "").replace(" Image", "").strip()
            files.append((file_name, fid))
        else:
            files.append((label, fid))
            
    return folders, files

duratex_id = "1D0CtPI_LvDK3baIF5PZaUAUT0KOVjb-z"
subfolders, files = get_folder_contents(duratex_id)
print(f"Duratex subfolders ({len(subfolders)}):", subfolders)
print(f"Duratex files ({len(files)}):", files[:5])

if subfolders:
    first_sub = subfolders[0]
    print(f"\nChecking first subfolder {first_sub[0]} ({first_sub[1]}):")
    sub_subfolders, sub_files = get_folder_contents(first_sub[1])
    print(f"  Sub-subfolders ({len(sub_subfolders)}):", sub_subfolders)
    print(f"  Files ({len(sub_files)}):", sub_files)
