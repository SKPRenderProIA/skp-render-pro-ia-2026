import urllib.request
import re
import json

url = "https://drive.google.com/drive/folders/1SFBLhpfKdlJpX-iVBY-RxpXpJCLFCKOo?usp=sharing"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
html = urllib.request.urlopen(req).read().decode("utf-8", errors="ignore")

print("HTML length:", len(html))

# Search for initialData or items
for line in html.split('\n'):
    if "window['_DRIVE_ivd']" in line or "data-view-id" in line or "initData" in line or "MDF" in line:
        print("Relevant line found:", line[:200])

# Regex for folder/file titles
found_titles = re.findall(r'\[\"([^\"]+)\",\[\"[^\"]+\"\]', html)
print("Found titles:", found_titles[:20])

# Search for all strings with extensions or subfolders like Duratex, Guararapes, etc.
for brand in ["Duratex", "Guararapes", "Sudati", "Placas", "Greenplac", "Fibraplac", "Arauco", "Zip", "zip", "rar"]:
    matches = [m.start() for m in re.finditer(brand, html, re.I)]
    print(f"Brand/term {brand}: {len(matches)} occurrences")
    for pos in matches[:3]:
        snippet = html[max(0, pos-40):min(len(html), pos+80)]
        print(f"   Snippet: {snippet.strip()}")
