import urllib.request
import re

folders = {
    "arauco": "1Qnbp-lGQUh0EpQ2SKU9SGtAls_jvZs1P",
    "Berneck": "1Ki2f2qiLnpW6ohKI8dd0ry6NxJBlBrFM",
    "duratex": "1D0CtPI_LvDK3baIF5PZaUAUT0KOVjb-z",
    "eucatex": "1dP-wYfx44290FuvVH56qtCThP5ROmFlY",
    "Fibraplac": "1prb0nVilxAPeuFFMufcDIKrfRCAOyNwY",
    "Floraplac": "1jK2qM99Tx2N0akGAPNLKEDMdwfn4dlac",
    "Greenplac": "10IoRvLrHHVeDCwxEGUw1XDPN-kX5Oq9M",
    "masisa": "1-52t4CDZb2ae4ASKEGtuLiEs4xkcJ24k",
    "Placas_do_Brasil": "1UikTr5C03pKDlsrtkZBRKxVYlj3jn7KX",
    "Sudati": "1wCa4qtUqsggREXIEzxBlH3mKLPn91vks"
}

for name, fid in list(folders.items())[:3]:
    url = f"https://drive.google.com/drive/folders/{fid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        html = urllib.request.urlopen(req).read().decode("utf-8", errors="ignore")
        # Extract items inside this folder
        items = re.findall(r'aria-label="([^"]+)"[^>]+ssk=[\x27"]([^\x27"]+)[\x27"]', html)
        print(f"\n=== Brand {name} ({len(items)} items found) ===")
        for label, ssk in items[:10]:
            print(f"  {label} (ssk: {ssk})")
    except Exception as e:
        print(f"Error fetching {name}: {e}")
