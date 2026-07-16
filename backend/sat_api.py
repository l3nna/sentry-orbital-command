import os
import math
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from skyfield.api import load

# Keeping your helper modules intact
from satellites import get_satellite_details, save_local_update

app = FastAPI()

# Enable CORS for Three.js frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Skyfield components
ts = load.timescale()

# --- TARGETING THE REAL-WORLD OPERATIONAL FLEET ---
ACTIVE_FLEET_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
FLEET_LIMIT = 400 

# --- EXPANDED BACKEND FILTER CONFIGURATION ---
LOAD_FILTERS = [
    # Space Stations & Local Assets (Uncommented to match stations.txt contents)
    "ISS", "TIANGONG", "CSS", "POISK", "TIANMU",
    
    # Global Navigation Networks (GPS)
     "GPS", "GLONASS", "GALILEO", "BEIDOU", 
    
    # Commercial Internet Mega-Constellations (Commented out as requested)
    # "STARLINK", "ONEWEB",
    
    # Weather & Earth Observation
     "NOAA", "METEO", "GOES", "LANDSAT", "SENTINEL", "AQUA", "TERRA",
    
    # Major Scientific / Telescopes
    "HUBBLE", "JWST", "FERMI", "CHANDRA",

    # ==========================================
    # MILITARY & DEFENSE SATELLITES
    # ==========================================
    
    # United States (Space Force / NRO)
    "USA",        # General designation for US military satellites
    "AEHF",       # Advanced Extremely High Frequency (Secure Comms)
    "WGS",        # Wideband Global SATCOM (Military Comms)
    "SBIRS",      # Space Based Infrared System (Missile Warning)
    "KH-11",      # Keyhole (Optical Reconnaissance / Spy Satellites)
    "ONYX",       # Radar Reconnaissance (Lacrosse/Onyx)
    
    # Russia (Kosmos Designation)
    "KOSMOS",     # General designation for Russian military/test payloads
    "BARS-M",     # Reconnaissance/Mapping
    "TUNDRA",     # Kupol/Tundra Missile Early Warning
    
    # China (Military / Reconnaissance)
    "YAOGAN",     # Yaogan series (Military Reconnaissance / ELINT)
    
    # Europe (France, UK, Germany)
    "SYRACUSE",   # France (Military Communications)
    "SKYNET",     # United Kingdom (Military Communications)
    "SAR-LUPE"    # Germany (Radar Reconnaissance)
]
satellites = []

# Check for local file, otherwise stream down the massive master list
if os.path.exists("stations.txt"):
    all_satellites = load.tle_file("stations.txt")
    
    if LOAD_FILTERS:
        print(f"Applying backend filter. Matching keywords: {LOAD_FILTERS}")
        filters_upper = [f.upper() for f in LOAD_FILTERS]
        
        for sat in all_satellites:
            # Append only if a keyword matches part of the satellite name
            if any(keyword in sat.name.upper() for keyword in filters_upper):
                satellites.append(sat)
                
        print(f"Filtered database down to {len(satellites)} matching targets.")
    else:
        satellites = all_satellites
else:
    print("Streaming live satellite database from CelesTrak...")
    satellites = load.tle_file(ACTIVE_FLEET_URL)

# Log initial launch time 
save_local_update()

def calculate_orbit_path(sat, current_time):
    """Calculates a future 100-minute orbital path array using proper time offsets."""
    points = []
    # Extract the base datetime in UTC safely
    base_dt = current_time.utc_datetime()
    
    for minute in range(0, 100, 5):
        # Use timedelta to cleanly roll over minutes, hours, and days automatically
        future_dt = base_dt + timedelta(minutes=minute)
        future_time = ts.from_datetime(future_dt)
        
        try:
            geocentric = sat.at(future_time)
            subpoint = geocentric.subpoint()
            points.append({
                "lat": subpoint.latitude.degrees,
                "lon": subpoint.longitude.degrees
            })
        except Exception:
            continue
    return points

@app.get("/satellites")
def get_live_telemetry():
    """
    Returns real-time calculated coordinates, look-ahead orbital paths,
    and extended payload telemetry matrices for the UI HUD.
    """
    t = ts.now()
    data = []

    # Process up to our defined fleet limit
    for sat in satellites[:FLEET_LIMIT]:
        try:
            # 1. Calculate real-time geographic telemetry vectors from fresh data
            geocentric = sat.at(t)
            subpoint = geocentric.subpoint()
            
            # --- EXTENDED MATHEMATICAL TELEMETRY CALCULATIONS ---
            # Earth Radius ~6371 km. Convert semi-major axis (r) to meters
            alt_km = float(subpoint.elevation.km)
            r_meters = (6371.0 + alt_km) * 1000.0
            
            # Standard gravitational parameter (G * M) of Earth
            mu = 3.986004418e14
            
            # Vis-Viva equation for circular velocity: v = sqrt(mu / r) 
            speed_ms = math.sqrt(mu / r_meters)
            speed_kmh = speed_ms * 3.6
            
            # Kepler's Third Law for orbital period: T = 2 * pi * sqrt(r^3 / mu)
            period_mins = (2 * math.pi * math.sqrt(math.pow(r_meters, 3) / mu)) / 60.0
            
            # 2. Extract profile records 
            details = get_satellite_details(sat.name) if 'get_satellite_details' in globals() else {}

            # --- DYNAMIC STRUCTURAL PROFILE GENERATOR ---
            name_upper = sat.name.upper()
            
            # Default fallbacks
            sat_type = "Scientific Payload"
            country = "International"
            description = "Research platform conducting microgravity observation and atmospheric core sampling."
            dimensions = "2.4m × 1.8m × 1.2m"
            power_source = "Dual GaAs Solar Arrays"

            if "STARLINK" in name_upper:
                sat_type = "Communication"
                country = "United States (SpaceX)"
                description = "Low-Earth orbit satellite mesh element providing high-bandwidth, low-latency global internet coverage."
                dimensions = "3.2m × 1.6m Flat Panel"
                power_source = "Single Krypton Ion-Thrust Solar Wing"
            elif "ONEWEB" in name_upper:
                sat_type = "Communication"
                country = "United Kingdom (Eutelsat)"
                description = "Commercial constellations streaming high-capacity internet links to remote enterprise gateways."
                dimensions = "1.0m × 1.0m × 1.3m"
                power_source = "Dual Sun-Tracking Solar Panels"
            elif "GPS" in name_upper:
                sat_type = "Navigation"
                country = "United States (USSF)"
                description = "Next-gen atomic clock broadcasting ultra-precise timing arrays for global navigation positioning."
                dimensions = "2.5m × 2.0m Body"
                power_source = "High-Efficiency Triple-Junction Arrays"
            elif "GLONASS" in name_upper:
                sat_type = "Navigation"
                country = "Russia (Roscosmos)"
                description = "Military and civilian navigation fallback core maintaining real-time global positioning matrices."
                dimensions = "2.0m Cylinder"
                power_source = "Dual-Wing Photovoltaic Panels"
            elif "GALILEO" in name_upper:
                sat_type = "Navigation"
                country = "European Union (ESA)"
                description = "High-precision commercial civilian navigation array operating outside independent military controls."
                dimensions = "2.7m × 1.1m"
                power_source = "Regulated Gallium-Arsenide Solar Panels"
            elif "BEIDOU" in name_upper:
                sat_type = "Navigation"
                country = "China (CNSA)"
                description = "Global navigation satellite infrastructure providing high-accuracy geographic positioning services."
                dimensions = "2.2m Cuboid"
                power_source = "Deployable Solar Tracking Wings"
            elif any(x in name_upper for x in ["ISS", "ZARYA", "POISK"]):
                sat_type = "Space Station Core"
                country = "International (NASA / Roscosmos / ESA / JAXA)"
                description = "Habitable orbital research laboratory hosting continuous international scientific operations in microgravity."
                dimensions = "109m × 73m Modular Grid"
                power_source = "8 Deployable Solar Array Wings (120kW)"
            elif any(x in name_upper for x in ["TIANGONG", "CSS", "TIANHE"]):
                sat_type = "Space Station Core"
                country = "China (CNSA)"
                description = "Permanent modular space station exploring human long-duration orbital deployment profiles."
                dimensions = "16.6m Core Module"
                power_source = "Flexible Gallium Arsenide Solar Ribbons"
            elif "TIANMU" in name_upper:
                sat_type = "Atmospheric GNSS-RO"
                country = "China (CASC)"
                description = "Commercial small satellite constellation collecting high-precision meteorological sounding profiles via GNSS radio occultation."
                dimensions = "0.6m × 0.6m × 0.8m Cube"
                power_source = "Deployable Solar Tracking Panels"
            elif any(x in name_upper for x in ["NOAA", "METEO", "GOES", "LANDSAT", "SENTINEL", "AQUA", "TERRA"]):
                sat_type = "Weather & Earth Observation"
                country = "United States (NOAA / NASA)"
                description = "Meteorological imaging array supplying high-resolution climate tracking models and storm warnings."
                dimensions = "4.2m Cylinder"
                power_source = "Single-Wing Asymmetric Solar Array"
            
            # --- DEFENSE AND INTELLIGENCE SATELLITE PROFILES ---
            elif "AEHF" in name_upper:
                sat_type = "Military Communications"
                country = "United States (USSF)"
                description = "Extremely high frequency satellite delivering highly secure, jam-resistant tactical communications networks for strategic allied command units."
                dimensions = "9.5m × 23.3m (Deployed)"
                power_source = "Dual 5-Panel GaAs Solar Wings"
            elif "WGS" in name_upper:
                sat_type = "Military Communications"
                country = "United States (USSF)"
                description = "Wideband high-capacity communication hub servicing global tactical forces, drone operations, and critical command networks."
                dimensions = "2.8m × 3.4m × 5.6m"
                power_source = "GaAs Solar Panels generating 11kW"
            elif "SBIRS" in name_upper:
                sat_type = "Missile Early Warning"
                country = "United States (USSF)"
                description = "Infrared monitoring network detecting heat signatures to warn strategic command of global ballistic missile launches."
                dimensions = "3.2m × 2.0m × 2.2m"
                power_source = "Dual Deployable Solar Arrays"
            elif "KH-11" in name_upper or "ONYX" in name_upper:
                sat_type = "Reconnaissance / Spy Satellite"
                country = "United States (NRO)"
                description = "Highly classified electro-optical telescope or radar intelligence satellite capturing extreme-resolution surveillance imagery."
                dimensions = "19.5m Length × 3.0m Diameter"
                power_source = "High-Yield Multi-Segment Solar Panels"
            elif "USA" in name_upper:
                sat_type = "Classified Military Mission"
                country = "United States (USSF / NRO)"
                description = "Classified operational defense payload conducting strategic intelligence, secure networking, or space domain awareness."
                dimensions = "Classified Structural Framework"
                power_source = "Classified Solar Arrays"
            elif "BARS-M" in name_upper:
                sat_type = "Military Mapping / Recon"
                country = "Russia (VKS)"
                description = "Electro-optical mapping satellite producing high-resolution military topographic data and tactical terrain layouts."
                dimensions = "4.0m × 2.0m"
                power_source = "GaAs Sun-Tracking Panels"
            elif "TUNDRA" in name_upper:
                sat_type = "Early Warning System"
                country = "Russia (VKS)"
                description = "Highly-elliptical orbit (HEO) early warning asset monitoring strategic theater airspace for ballistic launches."
                dimensions = "3.5m × 2.2m"
                power_source = "Dual Deployable Solar Ribbons"
            elif "KOSMOS" in name_upper:
                sat_type = "Military Spacecraft"
                country = "Russia (VKS)"
                description = "Russian military payload designated under the Kosmos sequence, conducting classified defense and observation missions."
                dimensions = "Varies by Mission Subtype"
                power_source = "Dual Solar Tracking Wings"
            elif "YAOGAN" in name_upper:
                sat_type = "Military Reconnaissance (ELINT/SAR)"
                country = "China (CNSA / PLA)"
                description = "Sub-meter electro-optical, radar imaging, or electronic intelligence (ELINT) constellation tracking military and maritime deployments."
                dimensions = "3.2m × 2.5m (Estimated)"
                power_source = "Deployable Photovoltaic Wings"
            elif "SYRACUSE" in name_upper:
                sat_type = "Military Communications"
                country = "France (DGA)"
                description = "Secured satellite system enabling critical tactical communications and operational links for French defense forces."
                dimensions = "2.5m × 4.0m"
                power_source = "Dual High-Efficiency GaAs Panels"
            elif "SKYNET" in name_upper:
                sat_type = "Military Communications"
                country = "United Kingdom (MoD)"
                description = "Strategic and tactical high-capacity communications network supporting British and allied deployments worldwide."
                dimensions = "2.1m × 2.4m × 3.6m"
                power_source = "Dual Sun-Tracking Wings"
            elif "SAR-LUPE" in name_upper:
                sat_type = "Radar Reconnaissance"
                country = "Germany (Bundeswehr)"
                description = "High-resolution radar-imaging system returning tactical military telemetry regardless of weather or sunlight."
                dimensions = "4.0m × 3.0m × 2.0m"
                power_source = "Fixed High-Yield Panels"

            # 4. Pack sanitized positions safely for backend transport JSON
            data.append({
                "id": sat.model.satnum,
                "name": sat.name,
                "lat": float(subpoint.latitude.degrees), 
                "lon": float(subpoint.longitude.degrees),
                "alt": alt_km,
                "type": sat_type,
                "country": details.get("country", country),
                "purpose": details.get("purpose", f"NORAD DEPLOYMENT #{sat.model.satnum}"),
                "orbit": calculate_orbit_path(sat, t),
                
                # --- NEW LIVE MATHEMATICAL TELEMETRY PROPERTIES ---
                "speed": round(speed_kmh, 2),
                "period": round(period_mins, 2),
                "dimensions": dimensions,
                "power": power_source,
                "desc": description
            })
        except Exception:
            # Skip any corrupt or unparseable satellite records gracefully
            continue

    return {
        "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "satellites": data
    }

# --- STATIC FRONTEND ROUTING FIX ---
current_dir = os.path.dirname(os.path.abspath(__file__))

# Serve static directory assets and configure it to automatically deliver index.html at root "/"
app.mount("/", StaticFiles(directory=current_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)