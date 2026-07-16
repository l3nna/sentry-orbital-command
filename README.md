# 🛰️ Sentry Command: Satellite Tactical Hub

An interactive, dual-engine orbital tracking and tactical visualization interface. This system syncs raw satellite Two-Line Element (TLE) data directly from global space catalogs, solves the Keplerian orbital mechanics to extract altitude, period, and tracking vectors, and serves a high-fidelity cyberpunk visual control deck.

![Sentry System Active](https://img.shields.io/badge/SENTRY_SYSTEM-ACTIVE-00f3ff?style=flat-square)
![Telemetry Engine](https://img.shields.io/badge/Engine-Python_3.x-blue?style=flat-square)
![Visualization](https://img.shields.io/badge/Console-HTML5_%2F_Canvas-00f3ff?style=flat-square)

---

## 🛠️ System Architecture

The tactical hub is built using a decoupled architecture:

1. **Backend / Data Sync Core**
   * Connects to secure CelesTrak servers to scrape active satellite categories.
   * If offline, performs a full programmatic fallback to local databases.
   * Parses raw TLE files to calculate orbital characteristics (Semi-Major Axis, Period, Eccentricity, Apogee, Perigee, and Average Altitude) utilizing Keplerian mechanics.
   * Classifies assets dynamically (Space Stations, GPS, Mega-Constellations, Earth Obs, Telescopes, and Space Debris).
   * Generates a unified local database for the frontend to consume.

2. **Frontend / Command & Intercept Overlay**
   * Single-page cyberpunk dashboard with active filter matrix, category search, and real-time UTC tactical clocks.
   * Responsive **Interactive Radar Map** drawn via HTML5 Canvas showing relative orbital projections, movement, and command-laser lock indicators.
   * Live telemetry HUD instantly reflecting active target profile stats.

---

## 🚀 Quick Start Protocol

Follow these commands to deploy the system locally:

### 1. Synchronize the Fleet Database
Run the Python synchronization script to scrape live internet data (or parse local fallbacks if offline):

```bash
python <YOUR_PYTHON_SCRIPT_NAME>.py
