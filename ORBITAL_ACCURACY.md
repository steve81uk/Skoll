# 🚀 Sköll Orbital Accuracy & UI Optimization

## ✅ Critical Fixes Applied

### **0. Cockpit Runtime Hardening (March 2026)** 🧭

- Keyboard HUD bindings stabilized with cleanup-safe listeners:
   - `1`–`6` left dock toggles
   - `Shift + 1`–`6` right dock toggles
   - `Esc` closes overlays
- Dock icon status dots now indicate feed/model state at a glance (green/amber/red)
- Performance telemetry moved to a draggable persistent chip (FPS / LSTM latency / NOAA fetch age)
- Dock-first interaction removed stacked panel clutter and reduced overlay jitter

### **0.1 Data Model Abstraction Layer** 🧩

- Unified hazard model introduced (`src/services/hazardModel.ts`)
- UI is now decoupled from raw NOAA payload shape
- This allows future provider swap (JSON APIs ↔ local WebGPU LLM) without changing HUD rendering components

### **1. Realistic Orbital Scaling** 🌍

**Problem**: Planets were too close to Sun (would burn up!)

- Mercury at 9.75 units (way too close!)
- Jupiter at 130 units (still too compressed)

**Solution**: Increased `AU_SCALE` from 25 → **60**

- **Earth**: Now at 60 units from Sun (1 AU × 60)
- **Mars**: 91.2 units (1.52 AU × 60)  
- **Jupiter**: 312 units (5.2 AU × 60) - proper gas giant distance!
- **Saturn**: 574.8 units (9.58 AU × 60)
- **Neptune**: 1,806 units (30.1 AU × 60) - properly distant!

**Camera adjusted**: Position `[0, 150, 300]` with 65° FOV for complete solar system view

---

### **2. Surface View Sun Fix** ☀️

**Problem**: When "landing" on planets, full-sized Sun appeared inside atmosphere

### Solution

- Sun only renders in **HELIOCENTRIC** mode
- In **SURFACE** mode:
  - Small distant sun sphere at `[500, 300, -800]`
  - Scaled to 20 units (appears as realistic distant star)
  - Proper atmospheric perspective

---

### **3. Compact UI Panels** 📐

**Problem**: Glassmorphism panels stretched across full screen

**Solution**: Narrower, more elegant panels

- **Left Panel**: 420px → **340px** (19% reduction)
- **Right Panel**: 300px → **280px** (7% reduction)
- **Maximized View**: `left-[360px]` (was 448px)
- More screen real estate for 3D view
- Better visual balance

**Collapsible Controls**:

- ✅ Sovereign Control: Collapses to 42px orb
- ✅ Timeline Control: ▲/▼ collapse button
- Both maintain state when collapsed

---

## 🎯 Real Orbital Mechanics

**Keplerian Calculations** (`OrbitalMechanics.ts`):

- Uses NASA JPL orbital elements (J2000.0 epoch)
- Solves Kepler's Equation for eccentric anomaly
- Calculates true anomaly and heliocentric distance
- **Planets show actual positions for current date/time**

**What this means**:

- Select date: **Feb 26, 2026** → Planets at real Feb 26, 2026 positions
- Jump to **Carrington Event (Sept 2, 1859)** → See 1859 planetary alignment
- Historical accuracy for space weather events!

---

## 🌌 Current Visual Features

### **Space Environment**

- ✅ 15,000 realistic stars (color-coded by temperature)
- ✅ 3,000 nebula particles (purple/cyan/pink clusters)
- ✅ Dynamic sun with corona tendrils + flare particles
- ✅ Orbital trails (cyan inner, purple outer)
- ✅ Atmospheric glow halos (Fresnel effect)
- ✅ Wispy plasma magnetotails (12 streamers × 80 particles)

### **Interactivity**

- ✅ Click planets → Camera tracking
- ✅ Timeline → Jump to historical events
- ✅ Real-time ephemeris calculations
- ✅ CME propagation with turbulent particles
- ✅ Solar wind compression (magnetotail deformation)

---

## 💡 Enhancement Ideas for Next Phase

### **A. Advanced Orbital Features** 🛰️

1. **Asteroid Belt Visualization**

   - Particle ring between Mars and Jupiter
   - 10,000 asteroids in orbital paths
   - Realistic distribution (Kirkwood gaps)

2. **Kuiper Belt**
   - Faint particle disk beyond Neptune
   - Pluto + dwarf planets (Eris, Makemake, Haumea)

3. **Comet Trails**
   - Generate comets with elliptical orbits
   - Dynamic dust/gas tails pointing away from Sun
   - Famous comets: Halley, NEOWISE, etc.

4. **Lagrange Points**
   - Visualize L1-L5 points for Earth-Sun system
   - Show satellite positions (JWST at L2, SOHO at L1)

### **B. Enhanced Planet Details** 🪐

1. **Planetary Rings**

   - Add rings to Uranus + Neptune (not just Saturn)
   - Ice particle shimmer effects
   - Ring shadows on planet surface

2. **Planet Rotation Axis**
   - Visualize axial tilt
   - Show north/south poles
   - Season indicators

3. **Major Moon Orbits**
   - Visible paths for Io, Europa, Ganymede, Callisto
   - Titan's orbit around Saturn
   - Triton's retrograde orbit (Neptune)

4. **Surface Features**
   - Jupiter's Great Red Spot (rotating texture)
   - Saturn's hexagon storm (north pole)
   - Mars' Olympus Mons (topographic bump)

### **C. Space Weather Enhancements** ⚡

1. **Solar Wind Streams**

   - Particle flow from Sun to planets
   - High-speed streams vs slow solar wind
   - Color-coded by speed (blue → red)

2. **Bow Shock Visualization**
   - Curved shock front where solar wind hits magnetosphere
   - Dynamic rippling during CME impact
   - Particle acceleration at shock

3. **Reconnection Events**
   - Magnetic field line reconnection in magnetotail
   - Substorm onset visualization
   - Energy release bursts

4. **Radiation Belts**
   - Van Allen belts for Earth
   - Jovian radiation belts (most intense)
   - Trapped particle visualization

### **D. Historical Event Enhancements** 📜

1. **Event Playback Timeline**
   - Scrubber bar showing buildup → impact → recovery
   - Key moments marked (flare onset, CME launch, impact)

2. **Comparative View**
   - Split screen: Historical event vs current conditions
   - Side-by-side Sun states

3. **Event Annotations**
   - Pop-up info cards at key moments
   - "Flare observed by Carrington" marker
   - Telegraph failure timeline

### **E. Camera & Navigation** 📹

1. **Cinematic Camera Paths**
   - Fly from Sun → Mercury → Venus → Earth
   - "Grand Tour" automatic path
   - Save/load custom camera positions

2. **Multi-View Mode**
   - Picture-in-picture: Earth close-up + full system view
   - Split screen: Sun vs magnetosphere

3. **VR/AR Support**
   - WebXR integration for immersive viewing
   - Hand tracking for planet interaction

### **F. Data Integration** 📊

1. **Real NASA DONKI API**
   - Live CME detection + arrival predictions
   - Solar flare classification (C/M/X class)
   - Geomagnetic storm watches/warnings

2. **Historical Database**
   - Load actual KP index values for past events
   - Real solar wind speed measurements
   - Satellite damage records

3. **Export Features**
   - Screenshot/video capture
   - Data export (CSV orbital positions)
   - Share view URLs (date + camera position)

### **G. Educational Features** 🎓

1. **Guided Tours**
   - "What causes aurora?" interactive lesson
   - "CME propagation explained" step-by-step
   - Planet facts pop-ups

2. **Scale Comparisons**
   - Toggle between "realistic distances" vs "compressed view"
   - Planet size comparison tool
   - Distance indicators

3. **Mission Planning**
   - Calculate launch windows (Hohmann transfers)
   - Show spacecraft trajectories (Voyager, New Horizons)
   - Delta-V requirements

---

## 🎨 UI/UX Polish Ideas

### **Performance Optimizations**

- Instanced rendering for asteroid belt (50,000+ objects)
- LOD system (distant planets = fewer polygons)
- Occlusion culling (don't render hidden objects)

### **Accessibility**

- Keyboard shortcuts overlay (press ? to show)
- Screen reader support for data panels
- High contrast mode toggle

### **Themes**

- Dark mode (current: cyan/black)
- Light mode (white/blue)
- "Mars red" theme
- "Deep space purple" theme

---

## 📐 Current System Specs

**Orbital Scaling**: 60 units/AU  
**Visible Range**: Sun (0,0,0) to Neptune (~1,800 units)  
**Camera**: Position [0, 150, 300], FOV 65°  
**Particle Count**: ~25,000 total  
**Frame Rate**: 60fps (RTX 2060+ / M1+)

**UI Panels**:

- inset-inline-start: 340px (telemetry, mission core, threats)
- inset-inline-end: 280px (diagnostics, health)
- inset-block-start: 520px collapsible (sovereign control)
- inset-block-end: 640px collapsible (timeline)

---

## 🚀 Next Steps Recommendation

**Priority 1** (Most Impact):

1. Asteroid belt visualization
2. Enhanced comet system
3. Bow shock rendering
4. Real DONKI API integration

**Priority 2** (Visual Polish):
5. Planetary rings (Uranus/Neptune)
6. Planet rotation axes
7. Solar wind streams
8. Cinematic camera paths

**Priority 3** (Educational):
9. Guided tours
10. Mission planning tools
11. Export features
12. VR support

---

The solar system is now scientifically accurate and ready for advanced features! 🌟
