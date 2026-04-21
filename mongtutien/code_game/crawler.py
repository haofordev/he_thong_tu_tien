import os
import requests
import re
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://mongtutien.me/_nuxt/"
TARGET_DIR = r"c:\Users\phong\OneDrive\Desktop\inputdata\he_thong_tu_tien\mongtutien\code_game"
INITIAL_FILES = ["BDgdJmc1.js", "BpomCNr3.js", "Dm1kgA5T.js", "Icon.5sqgDFqb.css", "-qcpAwUY.js", "CjOBiZzT.js", "CWna86q_.js", "Blhi0KN4.js", "MBorder-B5zwibPL.BnZ4TJgP.css", "Cipd6bfN.js", "GlobalModal.Dk1V32Fx.css", "DGo4YY_3.js", "4bltAmxA.js", "giftcodes.XDDMrMml.css", "BdL7xEfD.js", "DWkJCf6l.js", "DJCXQEuS.js", "CS1e1Uqz.js", "BiUtp8s8.js", "Bzhu4YxG.js", "Co7iXMeQ.js", "MTag.C_RG7waG.css", "BX9r2WLT.js", "input.BOUykrHf.css", "oAqYeQzA.js", "EpU3CA75.js", "checkbox.CYcYAi4a.css", "auth.DZcqo4BB.css", "COMDNNQO.js", "register.o0o9VsJn.css", "BsdIKgNI.js", "BHxYJ0kx.js", "kIn0yDa_.js", "wives-with-draft.CXsamrUd.css", "B3CrSyDs.js", "index.CyZj4fCs.css", "CnqPMBmA.js", "default.dmPL9DYI.css", "DxPZA6P9.js", "error-404.DmmOxcUG.css", "CjwRpyp0.js", "error-500.Dv-yuu0Z.css"]

if not os.path.exists(TARGET_DIR):
    os.makedirs(TARGET_DIR)

downloaded = set()
# Add already existing files in the directory to 'downloaded' so we don't redownload them unless we want to scan them
for f in os.listdir(TARGET_DIR):
    downloaded.add(f)

queue = [f for f in INITIAL_FILES if f not in downloaded]
# We also want to scan the existing files if they haven't been scanned
to_scan = [f for f in downloaded if f.endswith('.js')]
queue.extend([f for f in INITIAL_FILES if f in downloaded]) # Re-add to ensure they get scanned if needed

def download_file(filename):
    url = urljoin(BASE_URL, filename.lstrip('./'))
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            filepath = os.path.join(TARGET_DIR, filename.lstrip('./'))
            # Ensure subdirectories exist if any (though these seem flat)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded: {filename}")
            return response.text
        else:
            print(f"Failed to download {url}: Status {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")
    return None

def find_links(content):
    # Matches patterns like "./filename.js", "./filename.css", etc.
    return re.findall(r'["\']\./([a-zA-Z0-9_\-\.]+\.(?:js|css))["\']', content)

# Main loop
queue = list(set(INITIAL_FILES)) # Start fresh with initial list
processed = set()

while queue:
    current = queue.pop(0)
    if current in processed:
        continue
    
    processed.add(current)
    
    # Download or read existing
    filepath = os.path.join(TARGET_DIR, current.lstrip('./'))
    content = None
    
    if os.path.exists(filepath):
        print(f"File exists, scanning: {current}")
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
    else:
        content = download_file(current)
    
    if content:
        new_links = find_links(content)
        for link in new_links:
            if link not in processed and link not in queue:
                queue.append(link)

print("Finished downloading all reachable files.")
