/**
 * SKÖLL-TRACK — TRUE J2000 KEPLERIAN ORBITAL MECHANICS v3.0
 *
 * Implements the NASA JPL "Approximate Positions of the Major Planets" method
 * Table 1 (Standish 1992, revised 2021). Accurate to ~1 arcminute 1800–2050.
 * Lunar theory: simplified Meeus Ch-47 (ELP-based). 5-term perturbation sum.
 * Galilean moons + Titan: Keplerian circular orbits around parent body.
 *
 * References:
 *   E.M. Standish (1992), "Keplerian Elements for Approximate Positions of
 *   the Major Planets", Solar System Dynamics Group, JPL/Caltech.
 *   https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *   Jean Meeus, "Astronomical Algorithms" 2nd ed., Ch.47.
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface OrbitalElements {
  semiMajorAxis: number;          // AU at J2000
  eccentricity: number;
  inclination: number;            // deg at J2000
  longitudeAscendingNode: number; // deg at J2000
  longitudePerihelion: number;    // deg at J2000
  meanLongitude: number;          // deg at J2000
  // Secular rates per Julian century (JPL Table 1)
  meanLongitudeRate: number;          // deg/cy — the critical mean motion
  longitudePerihelionRate: number;    // deg/cy
  longitudeAscendingNodeRate: number; // deg/cy
  eccentricityRate: number;           // /cy
  inclinationRate: number;            // deg/cy
  semiMajorAxisRate: number;          // AU/cy
}

export interface CartesianPosition { x: number; y: number; z: number; rAU: number }

interface SatelliteOrbit {
  parent: string; semiMajor: number; period: number;
  eccentricity: number; inclination: number; l0: number;
}

// ─── JPL Table 1: J2000.0 elements + secular rates 1800–2050 ─────────────────
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
export const ORBITAL_ELEMENTS: Record<string, OrbitalElements> = {
  Mercury: {
    semiMajorAxis:0.38709927,   semiMajorAxisRate:          0.00000037,
    eccentricity: 0.20563593,   eccentricityRate:           0.00001906,
    inclination:  7.00497902,   inclinationRate:           -0.00594749,
    meanLongitude:252.25032350, meanLongitudeRate:     149472.67411175,
    longitudePerihelion:77.45779628,   longitudePerihelionRate:    0.16047689,
    longitudeAscendingNode:48.33076593, longitudeAscendingNodeRate:-0.12534081,
  },
  Venus: {
    semiMajorAxis:0.72333566,   semiMajorAxisRate:          0.00000390,
    eccentricity: 0.00677672,   eccentricityRate:          -0.00004107,
    inclination:  3.39467605,   inclinationRate:           -0.00078890,
    meanLongitude:181.97909950, meanLongitudeRate:      58517.81538729,
    longitudePerihelion:131.60246718, longitudePerihelionRate: 0.00268329,
    longitudeAscendingNode:76.67984255, longitudeAscendingNodeRate:-0.27769418,
  },
  Earth: {
    semiMajorAxis:1.00000261,   semiMajorAxisRate:          0.00000562,
    eccentricity: 0.01671123,   eccentricityRate:          -0.00004392,
    inclination: -0.00001531,   inclinationRate:           -0.01294668,
    meanLongitude:100.46457166, meanLongitudeRate:      35999.37244981,
    longitudePerihelion:102.93768193, longitudePerihelionRate: 0.32327364,
    longitudeAscendingNode:0.0,  longitudeAscendingNodeRate: 0.0,
  },
  Mars: {
    semiMajorAxis:1.52371034,   semiMajorAxisRate:          0.00001847,
    eccentricity: 0.09339410,   eccentricityRate:           0.00007882,
    inclination:  1.84969142,   inclinationRate:           -0.00813131,
    meanLongitude:355.43327463, meanLongitudeRate:      19140.30268499,
    longitudePerihelion:336.04084342, longitudePerihelionRate: 0.44441088,
    longitudeAscendingNode:49.55953891, longitudeAscendingNodeRate:-0.29257343,
  },
  Jupiter: {
    semiMajorAxis:5.20288700,   semiMajorAxisRate:         -0.00011607,
    eccentricity: 0.04838624,   eccentricityRate:          -0.00013253,
    inclination:  1.30439695,   inclinationRate:           -0.00183714,
    meanLongitude: 34.39644051, meanLongitudeRate:       3034.74612775,
    longitudePerihelion:14.72847983,  longitudePerihelionRate:  0.21252668,
    longitudeAscendingNode:100.47390909, longitudeAscendingNodeRate:0.20469106,
  },
  Saturn: {
    semiMajorAxis:9.53667594,   semiMajorAxisRate:         -0.00125060,
    eccentricity: 0.05386179,   eccentricityRate:          -0.00050991,
    inclination:  2.48599187,   inclinationRate:            0.00193609,
    meanLongitude: 49.95424423, meanLongitudeRate:       1222.49309918,
    longitudePerihelion:92.59887831,  longitudePerihelionRate: -0.41897216,
    longitudeAscendingNode:113.66242448, longitudeAscendingNodeRate:-0.28867794,
  },
  Uranus: {
    semiMajorAxis:19.18916464,  semiMajorAxisRate:         -0.00196176,
    eccentricity: 0.04725744,   eccentricityRate:          -0.00004397,
    inclination:  0.77263783,   inclinationRate:           -0.00242939,
    meanLongitude:313.23810451, meanLongitudeRate:        428.48202785,
    longitudePerihelion:170.95427630, longitudePerihelionRate: 0.40805281,
    longitudeAscendingNode:74.01692503, longitudeAscendingNodeRate:0.04240589,
  },
  Neptune: {
    semiMajorAxis:30.06992276,  semiMajorAxisRate:          0.00026291,
    eccentricity: 0.00859048,   eccentricityRate:           0.00005105,
    inclination:  1.77004347,   inclinationRate:            0.00035372,
    meanLongitude:304.88003093, meanLongitudeRate:        218.45945325,
    longitudePerihelion:44.96476227,  longitudePerihelionRate:-0.32241464,
    longitudeAscendingNode:131.78422574, longitudeAscendingNodeRate:-0.00508664,
  },
  Pluto: {
    semiMajorAxis:39.48211675,  semiMajorAxisRate:         -0.00031596,
    eccentricity: 0.24882730,   eccentricityRate:           0.00005170,
    inclination: 17.14001206,   inclinationRate:            0.00004818,
    meanLongitude:238.92903833, meanLongitudeRate:        145.20780515,
    longitudePerihelion:224.06891629, longitudePerihelionRate:-0.04062942,
    longitudeAscendingNode:110.30393684, longitudeAscendingNodeRate:-0.01183482,
  },
};

// ─── Satellite orbits (sidereal, relative to parent) ─────────────────────────
export const SATELLITE_ORBITS: Record<string, SatelliteOrbit> = {
  Moon:   { parent:'Earth',   semiMajor:0.002570, period:27.321661, eccentricity:0.0549, inclination:5.145,  l0:218.316 },
  Io:     { parent:'Jupiter', semiMajor:0.002819, period: 1.769138, eccentricity:0.0041, inclination:0.04,   l0: 84.129 },
  Europa: { parent:'Jupiter', semiMajor:0.004486, period: 3.551181, eccentricity:0.0094, inclination:0.47,   l0:219.106 },
  Titan:  { parent:'Saturn',  semiMajor:0.008168, period:15.945421, eccentricity:0.0288, inclination:0.33,   l0:100.428 },
};

// ─── Math helpers ─────────────────────────────────────────────────────────────
const J2000_JD = 2451545.0;

function julianDay(d: Date): number { return d.getTime() / 86400000.0 + 2440587.5; }
function julianCenturies(d: Date): number { return (julianDay(d) - J2000_JD) / 36525.0; }
function toRad(deg: number): number { return (deg * Math.PI) / 180.0; }
function normalise(a: number): number { a = a % 360; return a < 0 ? a + 360 : a; }

function solveKepler(M_rad: number, e: number): number {
  let E = M_rad + e * Math.sin(M_rad) * (1 + e * Math.cos(M_rad));
  for (let i = 0; i < 10; i++) {
    const dE = (M_rad - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// ecliptic→Three.js: (+xEcl, +yEcl=eclipticNorth, +zEcl)→(+x, +y=up, +z)
function toThree(xE: number, yE: number, zE: number, r: number): CartesianPosition {
  return { x: xE, y: zE, z: yE, rAU: r };
}

// ─── Planet heliocentric position (J2000 ecliptic, AU) ───────────────────────
export function calculateOrbitalPosition(
  planetName: string,
  date: Date,
): { x: number; y: number; z: number; rAU?: number } {
  const el = ORBITAL_ELEMENTS[planetName];
  if (!el) return { x: 0, y: 0, z: 0 };

  const T  = julianCenturies(date);

  // Evolve elements with secular rates (this is the critical fix)
  const a  = el.semiMajorAxis          + el.semiMajorAxisRate          * T;
  const e  = Math.max(0, el.eccentricity + el.eccentricityRate         * T);
  const i  = toRad(normalise(el.inclination          + el.inclinationRate          * T));
  const Lm = normalise(el.meanLongitude          + el.meanLongitudeRate          * T);
  const wp = normalise(el.longitudePerihelion    + el.longitudePerihelionRate    * T);
  const Om = normalise(el.longitudeAscendingNode + el.longitudeAscendingNodeRate * T);

  const w  = toRad(normalise(wp - Om));
  const M  = toRad(normalise(Lm - wp));
  const OmR = toRad(Om);

  const E  = solveKepler(M, e);
  const v  = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
  const r  = a * (1 - e * Math.cos(E));

  const xOrb = r * Math.cos(v);
  const yOrb = r * Math.sin(v);

  const cosOm = Math.cos(OmR), sinOm = Math.sin(OmR);
  const cosW  = Math.cos(w),   sinW  = Math.sin(w);
  const cosI  = Math.cos(i);

  const xE = (cosOm*cosW - sinOm*sinW*cosI)*xOrb + (-cosOm*sinW - sinOm*cosW*cosI)*yOrb;
  const yE = (sinOm*cosW + cosOm*sinW*cosI)*xOrb + (-sinOm*sinW + cosOm*cosW*cosI)*yOrb;
  const zE = sinW*Math.sin(i)*xOrb + cosW*Math.sin(i)*yOrb;

  return { ...toThree(xE, yE, zE, r) };
}

// ─── Satellite position (adds offset from parent heliocentric pos) ────────────
export function calculateSatellitePosition(
  satName: string,
  date: Date,
  parentPos: { x: number; y: number; z: number },
): { x: number; y: number; z: number; rAU?: number } {
  const sat = SATELLITE_ORBITS[satName];
  if (!sat) return { ...parentPos };

  const Td = julianDay(date) - J2000_JD;
  const L  = normalise(sat.l0 + (360 / sat.period) * Td);
  const M  = toRad(normalise(L));
  const e  = sat.eccentricity;
  const E  = solveKepler(M, e);
  const v  = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
  const r  = sat.semiMajor * (1 - e * Math.cos(E));
  const inc = toRad(sat.inclination);

  const xR = r * Math.cos(v);
  const yR = r * Math.sin(v) * Math.cos(inc);
  const zR = r * Math.sin(v) * Math.sin(inc);

  // parentPos uses toThree mapping: y→eclZ, z→eclY
  return { x: parentPos.x + xR, y: parentPos.y + zR, z: parentPos.z + yR, rAU: r };
}

// ─── Moon: simplified Meeus Ch.47 (5-term ELP, ~0.15° accuracy) ─────────────
export function calculateMoonPosition(
  date: Date,
  earthPos: { x: number; y: number; z: number },
): { x: number; y: number; z: number; rAU?: number } {
  const T  = julianCenturies(date);
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;

  const Lp = normalise(218.3164477 + 481267.88123421*T - 0.0015786*T2 + T3/538841  - T4/65194000);
  const D  = normalise(297.8501921 + 445267.1114034 *T - 0.0018819*T2 + T3/545868  - T4/113065000);
  const M  = normalise(357.5291092 +  35999.0502909 *T - 0.0001536*T2 + T3/24490000);
  const Mp = normalise(134.9633964 + 477198.8675055 *T + 0.0087414*T2 + T3/69699   - T4/14712000);
  const F  = normalise( 93.2720950 + 483202.0175233 *T - 0.0036539*T2 - T3/3526000 + T4/863310000);
  const E  = 1 - 0.002516*T - 0.0000074*T2;
  const E2 = E * E;

  // Longitude (20 terms) and distance (same table)
  const lTerms: [number,number,number,number,number,number][] = [
    [ 0,0, 1,0, 6288774,-20905355],[ 2,0,-1,0, 1274027, -3699111],
    [ 2,0, 0,0,  658314, -2955968],[ 0,0, 2,0,  213618,  -569925],
    [ 0,1, 0,0, -185116,    48888],[ 0,0, 0,2, -114332,    -3149],
    [ 2,0,-2,0,   58793,   246158],[ 2,-1,-1,0,  57066,  -152138],
    [ 2,0, 1,0,   53322,  -170733],[ 2,-1,0,0,   45758,  -204586],
    [ 0,1,-1,0,  -40923,  -129620],[ 1,0, 0,0,  -34720,   108743],
    [ 0,1, 1,0,  -30383,    10321],[ 2,0,0,-2,   15327,    79661],
    [ 0,0, 1,2,  -12528,        0],[ 0,0,1,-2,   10980,   132592],
    [ 4,0,-1,0,   10675,   -70434],[ 0,0,3,0,    10034,   -60269],
    [ 4,0,-2,0,    8548,    16452],[ 2,1,-1,0,   -7888,    11866],
  ];
  let sumL = 0, sumR = 0;
  for (const [nD,nM,nMp,nF,cl,cr] of lTerms) {
    const eF = Math.abs(nM)===2 ? E2 : Math.abs(nM)===1 ? E : 1;
    const arg = toRad(nD*D + nM*M + nMp*Mp + nF*F);
    sumL += cl * Math.sin(arg) * eF;
    sumR += cr * Math.cos(arg) * eF;
  }
  const bTerms: [number,number,number,number,number][] = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],
    [2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
    [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],
  ];
  let sumB = 0;
  for (const [nD,nM,nMp,nF,cb] of bTerms) {
    const eF = Math.abs(nM)===2 ? E2 : Math.abs(nM)===1 ? E : 1;
    sumB += cb * Math.sin(toRad(nD*D + nM*M + nMp*Mp + nF*F)) * eF;
  }

  const lambda = toRad(normalise(Lp + sumL / 1e6));
  const beta   = toRad(sumB / 1e6);
  const distAU = (385000.56 + sumR / 1000.0) / 149597870.7;

  const xE = distAU * Math.cos(beta) * Math.cos(lambda);
  const yE = distAU * Math.cos(beta) * Math.sin(lambda);
  const zE = distAU * Math.sin(beta);

  return { x: earthPos.x + xE, y: earthPos.y + zE, z: earthPos.z + yE, rAU: distAU };
}

/**
 * Convert a calendar year (CE/BCE) to JPL Julian centuries from J2000.0.
 * Works for any year — including deep-time epochs far outside normal Date range.
 */
export function epochYearToT(year: number): number {
  // 1 Julian century = 36525 days
  // T ≈ (year - 2000) / 100  (exact to within ~1 day/century)
  return (year - 2000) / 100;
}

/**
 * Compute heliocentric ecliptic XYZ (AU) directly from Julian centuries T.
 * Identical algebra to calculateOrbitalPosition but bypasses Date arithmetic,
 * enabling deep-time epoch positions and use inside useFrame (no allocation).
 *
 * Valid for any T; secular extrapolation degrades gracefully outside ±2 cy.
 * For |T| > 50 (~5000 yr), the mean-longitude term dominates and the planet
 * will simply be somewhere on its orbit — correct enough for visualisation.
 */
export function calculateOrbitalPositionByT(
  planetName: string,
  T: number,
): CartesianPosition {
  const el = ORBITAL_ELEMENTS[planetName];
  if (!el) return { x: 0, y: 0, z: 0, rAU: 0 };

  // Barycentric guard: clamp secular-rate multiplier to ±50 Julian centuries
  // (~5 000 yr) to prevent semi-major axis and eccentricity from diverging at
  // deep-time epochs (e.g. Hadean T ≈ −45 000 000 cy would push Mercury 16 AU
  // from its actual orbit, causing planets to vanish from the scene).
  // Mean-motion terms (Lm, wp, Om) keep full T so planets continue to orbit.
  const Tc   = Math.max(-50, Math.min(50, T));

  // Evolve orbital elements using guarded Tc (±50 cy barycentric approximation)
  const a   = el.semiMajorAxis    + el.semiMajorAxisRate    * Tc;
  const e   = Math.max(0, Math.min(0.97, el.eccentricity + el.eccentricityRate * Tc));
  const iDeg = Math.min(180, Math.max(-180, el.inclination + el.inclinationRate * Tc));
  const Lm  = normalise(el.meanLongitude          + el.meanLongitudeRate          * T);
  const wp  = normalise(el.longitudePerihelion     + el.longitudePerihelionRate    * T);
  const Om  = normalise(el.longitudeAscendingNode  + el.longitudeAscendingNodeRate * T);

  const i   = toRad(iDeg);
  const w   = toRad(normalise(wp - Om));
  const M   = toRad(normalise(Lm - wp));
  const OmR = toRad(Om);

  const E   = solveKepler(M, e);
  const v   = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r   = a * (1 - e * Math.cos(E));

  const xOrb = r * Math.cos(v);
  const yOrb = r * Math.sin(v);

  const cosOm = Math.cos(OmR), sinOm = Math.sin(OmR);
  const cosW  = Math.cos(w),   sinW  = Math.sin(w);
  const cosI  = Math.cos(i);

  const xE = (cosOm*cosW - sinOm*sinW*cosI)*xOrb + (-cosOm*sinW - sinOm*cosW*cosI)*yOrb;
  const yE = (sinOm*cosW + cosOm*sinW*cosI)*xOrb + (-sinOm*sinW + cosOm*cosW*cosI)*yOrb;
  const zE = Math.sin(i)*Math.sin(w)*xOrb + Math.sin(i)*Math.cos(w)*yOrb;

  return toThree(xE, yE, zE, r);
}

/**
 * Get orbital period in Earth days (Kepler's 3rd law)
 */
export function getOrbitalPeriod(planetName: string): number {
  const el  = ORBITAL_ELEMENTS[planetName];
  if (el) return Math.sqrt(Math.pow(el.semiMajorAxis, 3)) * 365.25;
  const sat = SATELLITE_ORBITS[planetName];
  if (sat) return sat.period;
  return 365.25;
}

/**
 * Heliocentric distance at date (AU)
 */
export function getHeliocentricDistance(bodyName: string, date: Date): number {
  const pos = calculateOrbitalPosition(bodyName, date) as CartesianPosition;
  return pos.rAU ?? Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2);
}

/**
 * Ecliptic obliquity at date (deg) — needed for equatorial conversion
 */
export function eclipticObliquity(date: Date): number {
  const T = julianCenturies(date);
  return 23.439291111 - 0.013004167*T - 0.000000164*T**2 + 0.000000504*T**3;
}
