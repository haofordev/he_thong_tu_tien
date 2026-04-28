import os
import requests
import re
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://mongtutien.me/assets/"
TARGET_DIR = r"c:\Users\phong\OneDrive\Desktop\inputdata\he_thong_tu_tien\mongtutien\code_game"
INITIAL_FILES = [
    "index-C6IHU2kB.js", 
    "index-DjugjTyU.js", 
    "payloadGuards-tDJF4KGD.js", 
    "items-DGo4YY_3.js", 
    "index-BygMT7A9.css", 
    "auth-B0SCpCo4.js", 
    "auth-uQ39Jmgq.css", 
    "topup-ZBqj_kL6.js", 
    "topup-BF_eNIqx.css", 
    "online-inspector-CPWl4m6M.js", 
    "wives-with-draft-Bv2sPUAd.js", 
    "quality-BH_aoiN8.js", 
    "wives-with-draft-XEr3CfUa.css", 
    "index-CSffcNZ_.js", 
    "AdminQuickBar.vue_vue_type_script_setup_true_lang-C1uoBgdc.js", 
    "equipment-identity-DJIdo5yr.js", 
    "RuntimeMetricCard.vue_vue_type_script_setup_true_lang-CIfsoE4F.js", 
    "giftcodes-BP3V5Wj8.js", 
    "GlobalModal-B93woogG.js", 
    "profileFrames-MAQBtN0q.js", 
    "cosmeticCatalog-B6jlC8at.js", 
    "statTuning-BR3V3axB.js", 
    "cosmeticShopConfig-nEzvZ2uC.js", 
    "GlobalModal-D1HwuNcl.css", 
    "confirm-CyXNfNVw.js", 
    "giftcodes-BcpreiK6.css", 
    "mail-D8omanT3.js", 
    "players-B-c1hNMT.js", 
    "runtime-metrics-HE9ogl30.js", 
    "topup-BOCqv4r9.js", 
    "topupRewards-CmIXcu51.js", 
    "economy-BOUqLmAp.js"
]

if not os.path.exists(TARGET_DIR):
    os.makedirs(TARGET_DIR)

def download_file(filename):
    url = urljoin(BASE_URL, filename.lstrip('./'))
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            filepath = os.path.join(TARGET_DIR, filename.lstrip('./'))
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
    links = re.findall(r'["\'](?:\./|assets/)?([a-zA-Z0-9_\-\.]+\.(?:js|css))["\']', content)
    return list(set(links))

def get_basename(filename):
    if '-' in filename:
        return filename.rsplit('-', 1)[0]
    return filename.rsplit('.', 1)[0]

# Main loop
queue = [f for f in INITIAL_FILES if f.endswith('.js')]
processed = set()

while queue:
    current = queue.pop(0)
    if current in processed or not current.endswith('.js'):
        continue
    
    processed.add(current)
    
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
            if link.endswith('.js') and link not in processed and link not in queue:
                queue.append(link)

print("Finished downloading all reachable JS files.")

# Cleanup
print("Starting cleanup...")
all_files = os.listdir(TARGET_DIR)
latest_versions = {get_basename(f): f for f in processed}

for f in all_files:
    filepath = os.path.join(TARGET_DIR, f)
    if f == "crawler.py": continue
    
    if f.endswith('.css'):
        print(f"Removing CSS file: {f}")
        os.remove(filepath)
    elif f.endswith('.js'):
        basename = get_basename(f)
        if basename in latest_versions and f != latest_versions[basename]:
            print(f"Removing old version: {f}")
            os.remove(filepath)

print("Cleanup finished.")
