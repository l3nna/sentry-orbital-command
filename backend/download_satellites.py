import time
import requests

# A collection of target groups that make up the vast majority of active space assets
GROUPS = [
    "stations",       # Space Stations (ISS, Tiangong, etc.)
    "starlink",       # Starlink Fleet
    "oneweb",         # OneWeb Constellation
    "gps-ops",        # Operational GPS
    "glo-ops",        # Operational GLONASS
    "galileo",        # Galileo Navigation System
    "weather",        # Weather Satellites
    "active"          # General Active Payloads (Backup Catch-all)
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

master_tle_data = []
seen_sat_ids = set() # Prevent duplicate records across different overlapping groups

print("Initializing bulk payload download stream...")

for group in GROUPS:
    print(f"Downloading group: [{group}]...")
    url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=tle"
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code == 200 and response.text.strip():
            lines = response.text.strip().split("\n")
            
            # TLE data comes in blocks of 3 lines (Name, Line 1, Line 2)
            for i in range(0, len(lines) - 2, 3):
                name = lines[i].strip()
                line1 = lines[i+1].strip()
                line2 = lines[i+2].strip()
                
                # Extract the unique NORAD Catalog ID from Line 1 (columns 3-7)
                sat_id = line1[2:7].strip()
                
                if sat_id not in seen_sat_ids:
                    seen_sat_ids.add(sat_id)
                    master_tle_data.append(f"{name}\n{line1}\n{line2}\n")
                    
        elif response.status_code == 403:
            print(f"  -> Rate limit hit for [{group}]. Skipping...")
            
    except Exception as e:
        print(f"  -> Connection error on [{group}]: {e}")
        
    # CRITICAL: Sleep for 2 seconds between cycles so the firewall doesn't drop your IP address
    time.sleep(2)

if master_tle_data:
    with open("stations.txt", "w", encoding="utf-8") as f:
        f.writelines(master_tle_data)
    print("\n=========================================")
    print(f"SUCCESS! Consolidated {len(seen_sat_ids)} unique operational satellites into 'stations.txt'.")
    print("=========================================")
else:
    print("\nFailed to gather bulk data streams. Please try again later.")