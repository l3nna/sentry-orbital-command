# 🛰️ Sentry Command: Satellite Tactical Hub

An interactive, dual-engine orbital tracking and tactical visualization interface. This system features an asynchronous FastAPI backend that decodes real-time satellite Two-Line Element (TLE) data using Keplerian mechanics, serving live telemetry data to a high-fidelity cyberpunk visual control deck.

![Sentry System Active](https://img.shields.io/badge/SENTRY_SYSTEM-ACTIVE-00f3ff?style=flat-square)
![Backend API](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)
![Server](https://img.shields.io/badge/Server-Uvicorn-20232a?style=flat-square)
![Visualization](https://img.shields.io/badge/Console-HTML5_%2F_Canvas-00f3ff?style=flat-square)

---

## 🛠️ System Architecture

The tactical hub is split into a decoupled, high-performance architecture:

1. **`sat_api.py` (Asynchronous Python API Backend)**
   * Powered by **FastAPI** and served via **Uvicorn** for hot-reloading real-time telemetry stream.
   * Parses raw TLE files to calculate orbital characteristics (Semi-Major Axis, Period, Eccentricity, Apogee, Perigee, and Average Altitude) utilizing Keplerian mechanics.
   * Exposes structured REST endpoints allowing the front-end to dynamically query satellite datasets.

2. **`index.html` (Command & Intercept Overlay)**
   * Single-page cyberpunk dashboard with active filter matrix, category search, and real-time UTC tactical clocks.
   * Responsive **Interactive Radar Map** drawn via HTML5 Canvas showing relative orbital projections, movement, and command-laser lock indicators.
   * Pulls real-time orbital calculations directly from the live local FastAPI endpoints.

---

## 🚀 Quick Start Protocol

Follow these commands to deploy the system locally:

### 1. Launch the Live API Backend
Navigate to your project directory and run the FastAPI server via Uvicorn with hot-reload enabled:

```bash
python -m uvicorn sat_api:app --reload

![Demo](images/Animation.gif)
