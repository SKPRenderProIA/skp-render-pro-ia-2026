import re

with open("/tmp/drive_html.txt", "w", encoding="utf-8") as f:
    pass

import urllib.request
url = "https://drive.google.com/drive/folders/1SFBLhpfKdlJpX-iVBY-RxpXpJCLFCKOo?usp=sharing"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req).read().decode("utf-8", errors="ignore")

# Find aria-label="... Shared folder" and nearby IDs or data-id
matches = re.findall(r'aria-label="([^"]+ Shared folder)"[^>]+ssk=[\x27"]([^\x27"]+)[\x27"]', html)
print("Matches aria-label and ssk:", matches)

# Find all occurrences of folder IDs
all_items = re.findall(r'aria-label="([^"]+)"[^>]+(?:data-id|id|ssk)=[\x27"]([^\x27"]+)[\x27"]', html)
for label, id_val in all_items:
    if "Shared folder" in label:
        print(f"Folder: {label} -> {id_val}")

# In Google Drive HTML, folder items are often embedded in JSON like:
# ["<ID>", ... , "<Name>", ...]
# Let's search for "duratex", "Sudati", "Placas_do_Brasil", "Greenplac", "Fibraplac", "arauco"
for name in ["duratex", "Sudati", "Placas_do_Brasil", "Greenplac", "Fibraplac", "arauco"]:
    pos = html.find(f'"{name}"')
    if pos != -1:
        print(f"Found {name} at {pos}: {html[pos-100:pos+100]}")
    pos2 = html.find(f'"{name.capitalize()}"')
    if pos2 != -1:
        print(f"Found {name.capitalize()} at {pos2}: {html[pos2-100:pos2+100]}")
