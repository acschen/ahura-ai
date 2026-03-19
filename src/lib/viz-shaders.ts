// GLSL shaders for the generative emotion visualization

export const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

// Emotion parameters (smoothly interpolated on JS side)
uniform float u_engagement;   // 0-1
uniform float u_valence;      // -1 (frustrated) to 1 (happy)
uniform float u_arousal;      // 0 (bored) to 1 (excited)
uniform float u_confusion;    // 0-1

// Adaptive exploration parameters
uniform float u_hueShift;     // 0-1
uniform float u_complexity;   // 1-8 octaves
uniform float u_speed;        // 0.2-2.0
uniform float u_symmetry;     // 0-6 (fold count)
uniform float u_zoom;         // 0.5-3.0
uniform float u_distortion;   // 0-1

// --- Simplex 3D Noise (Ashima Arts) ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// Fractal Brownian Motion with variable octaves
float fbm(vec3 p, float octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (float i = 0.0; i < 8.0; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Domain warping for organic distortion
float warpedNoise(vec3 p, float octaves, float warp) {
  vec3 q = vec3(
    fbm(p + vec3(0.0, 0.0, 0.0), octaves),
    fbm(p + vec3(5.2, 1.3, 2.8), octaves),
    fbm(p + vec3(1.7, 9.2, 3.4), octaves)
  );
  vec3 r = vec3(
    fbm(p + 4.0 * q * warp + vec3(1.7, 9.2, 0.0), octaves),
    fbm(p + 4.0 * q * warp + vec3(8.3, 2.8, 0.0), octaves),
    0.0
  );
  return fbm(p + 4.0 * r * warp, octaves);
}

// Color palette function (Inigo Quilez technique)
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= u_resolution.x / u_resolution.y;

  // Apply zoom
  p *= u_zoom;

  // Apply radial symmetry
  if (u_symmetry > 0.5) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float sym = floor(u_symmetry);
    angle = mod(angle, 6.28318 / sym) * sym;
    p = vec2(cos(angle), sin(angle)) * radius;
  }

  // Time with speed control
  float t = u_time * u_speed;

  // Create the base noise pattern
  float octaves = u_complexity;
  float warp = 0.3 + u_distortion * 0.7 + u_confusion * 0.5;

  vec3 noiseCoord = vec3(p * (1.0 + u_arousal * 0.5), t * 0.3);
  float n = warpedNoise(noiseCoord, octaves, warp);

  // Add a second layer for depth
  float n2 = warpedNoise(noiseCoord * 1.5 + vec3(10.0), max(octaves - 2.0, 1.0), warp * 0.5);

  // Combine layers
  float pattern = n * 0.6 + n2 * 0.4;

  // === Color mapping based on emotion ===
  // Shift hue based on adaptive exploration + valence
  float hue = u_hueShift + u_valence * 0.15;

  // Define color palettes that blend based on emotion state
  vec3 colA, colB, colC, colD;

  // Engaged/Happy: warm golds, teals, purples
  vec3 engagedA = vec3(0.5, 0.5, 0.5);
  vec3 engagedB = vec3(0.5, 0.5, 0.5);
  vec3 engagedC = vec3(1.0, 1.0, 1.0);
  vec3 engagedD = vec3(hue, hue + 0.33, hue + 0.67);

  // Confused: shifting, unsettled colors
  vec3 confusedA = vec3(0.5, 0.5, 0.5);
  vec3 confusedB = vec3(0.5, 0.5, 0.3);
  vec3 confusedC = vec3(2.0, 1.0, 1.0);
  vec3 confusedD = vec3(hue + 0.5, hue + 0.2, hue + 0.1);

  // Frustrated: intense, sharp
  vec3 frustratedA = vec3(0.6, 0.3, 0.3);
  vec3 frustratedB = vec3(0.5, 0.3, 0.2);
  vec3 frustratedC = vec3(1.0, 1.0, 0.5);
  vec3 frustratedD = vec3(0.0, 0.1, 0.2);

  // Bored: muted, slow
  vec3 boredA = vec3(0.3, 0.3, 0.35);
  vec3 boredB = vec3(0.2, 0.2, 0.2);
  vec3 boredC = vec3(1.0, 1.0, 1.0);
  vec3 boredD = vec3(hue, hue + 0.1, hue + 0.2);

  // Blend palettes based on emotion state
  float engaged = u_engagement;
  float confused = u_confusion;
  float frustrated = max(0.0, -u_valence) * u_arousal;
  float bored = max(0.0, 1.0 - u_arousal) * (1.0 - u_engagement);

  // Normalize weights
  float totalW = engaged + confused + frustrated + bored + 0.001;
  engaged /= totalW;
  confused /= totalW;
  frustrated /= totalW;
  bored /= totalW;

  colA = engagedA * engaged + confusedA * confused + frustratedA * frustrated + boredA * bored;
  colB = engagedB * engaged + confusedB * confused + frustratedB * frustrated + boredB * bored;
  colC = engagedC * engaged + confusedC * confused + frustratedC * frustrated + boredC * bored;
  colD = engagedD * engaged + confusedD * confused + frustratedD * frustrated + boredD * bored;

  vec3 color = palette(pattern * 0.5 + 0.5, colA, colB, colC, colD);

  // Add glow/brightness based on engagement
  color *= 0.7 + u_engagement * 0.5;

  // Subtle vignette
  float vig = 1.0 - 0.3 * dot(uv - 0.5, uv - 0.5) * 4.0;
  color *= vig;

  // Gamma correction
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;
