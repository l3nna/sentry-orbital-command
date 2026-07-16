import json
import os
from datetime import datetime

# Build path relative to this script's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "satellites.json")

def load_local_data():
    """Loads data from the local satellites.json file safely."""
    if not os.path.exists(DATA_FILE):
        return {"last_updated": "", "custom_metadata": {}}
    
    with open(DATA_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"last_updated": "", "custom_metadata": {}}

def save_local_update():
    """Records the timestamp of when we last pulled or initialized the fleet elements."""
    # Ensure the data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    data = load_local_data()
    data["last_updated"] = datetime.utcnow().isoformat() + "Z"
    
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def get_satellite_details(sat_name):
    """Retrieves metadata or generates a procedural profile if it doesn't exist."""
    data = load_local_data()
    metadata = data.get("custom_metadata", {})
    
    # Strip whitespace to ensure clean dictionary lookups
    clean_name = sat_name.strip()
    
    if clean_name in metadata:
        return metadata[clean_name]
    
    # Procedural generation fallback so your frontend matrix looks active and distinct
    if "ISS" in clean_name or "CSS" in clean_name:
        return {"type": "Space Station", "country": "International", "purpose": "Scientific Research"}
    elif "DEB" in clean_name or "CAMERA" in clean_name or "DUPLEX" in clean_name:
        return {"type": "Space Debris", "country": "Unknown Origin", "purpose": "Orbital Discard / Tracking Asset"}
    else:
        return {"type": "Commercial Payload", "country": "Global Agency", "purpose": "Communications & Tactical Relay"}