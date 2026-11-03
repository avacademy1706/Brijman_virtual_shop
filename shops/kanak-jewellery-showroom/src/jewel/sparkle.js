// Sparkle: small star-shaped glints on diamonds and bright stones. Each glint flashes when a light reflects off a
// facet towards the viewer (so glints change as you walk, turn a piece or move your head in the try-on) and
// twinkles a little on its own. Billboards are sized in pixels, so a ring across the store still sparkles.
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iUp;
attribute float iSize;
attribute float iSeed;
uniform float time;
uniform float pxPerUnit;
uniform vec2 viewport;
uniform float gain;
uniform float maxPx;
uniform float minPx;
uniform float ortho;
uniform vec3 lights[4];
varying vec2 vUv;
varying float vI;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec3 h3(float n) { return vec3(h1(n), h1(n + 1.7), h1(n + 3.3)) * 2.0 - 1.0; }
void main() {
  vec4 wp = modelMatrix * vec4(iPos, 1.0);
  vec3 up = normalize(mat3(modelMatrix) * iUp);
  // an orthographic camera looks along its own -z everywhere
  vec3 V = ortho > 0.5 ? normalize((inverse(viewMatrix) * vec4(0.0, 0.0, 1.0, 0.0)).xyz) : normalize(cameraPosition - wp.xyz);
  // a facet normal near the stone's table, different for every glint
  vec3 n = normalize(up * 1.1 + h3(iSeed) * 0.9);
  vec3 Rv = reflect(-V, n);
  float g = 0.0;
  for (int i = 0; i < 4; i++) g += pow(max(dot(Rv, normalize(lights[i])), 0.0), 70.0);
  float tw = pow(0.5 + 0.5 * sin(time * (1.3 + h1(iSeed) * 2.2) + iSeed * 37.0), 10.0);
  float I = gain * (g * 1.4 + tw * 0.45) * smoothstep(-0.1, 0.4, dot(up, V));
  vI = I;
  float sc = length(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
  vec4 vp = viewMatrix * wp;
  // pull the glint to the front of its stone so the stone does not hide it
  if (ortho > 0.5) vp.z += iSize * sc * 0.6;
  else vp.xyz += normalize(-vp.xyz) * iSize * sc * 0.6;
  vec4 clip = projectionMatrix * vp;
  float stonePx = ortho > 0.5 ? iSize * sc * pxPerUnit : iSize * sc * pxPerUnit / max(1e-4, -vp.z);
  float px = clamp(stonePx * 2.6, minPx, maxPx) * clamp(I, 0.0, 1.6);
  if (I < 0.03 || (ortho < 0.5 && vp.z > 0.0)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  clip.xy += position.xy * px / viewport * 2.0 * clip.w;
  gl_Position = clip;
  vUv = position.xy;
}`;
const FRAG = /* glsl */ `
varying vec2 vUv;
varying float vI;
void main() {
  vec2 p = vUv;
  float r = length(p);
  float core = exp(-r * r * 22.0);
  float rays = exp(-abs(p.x) * 46.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 46.0) * exp(-abs(p.x) * 2.6);
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  rays += 0.4 * (exp(-abs(q.x) * 60.0) * exp(-abs(q.y) * 5.5) + exp(-abs(q.y) * 60.0) * exp(-abs(q.x) * 5.5));
  float a = (core * 1.3 + rays) * smoothstep(1.0, 0.55, r);
  float k = a * vI * 2.4;
  // colour adds; alpha adds a little too, so on a transparent canvas (the try-on) the glint shows over the video
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * k, clamp(k * 0.35, 0.0, 1.0));
}`;

/**
 * A sparkle layer for a list of glints [{ pos: Vector3, size, up: Vector3 }] in the parent's units.
 * lights: up to four world directions the glints reflect.
 */
export function makeSparkle(glints, o) {
  o = o || {};
  const n = glints.length;
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const P = new Float32Array(n * 3),
    U = new Float32Array(n * 3),
    Sz = new Float32Array(n),
    Sd = new Float32Array(n);
  glints.forEach((g, i) => {
    P[i * 3] = g.pos.x;
    P[i * 3 + 1] = g.pos.y;
    P[i * 3 + 2] = g.pos.z;
    const u = g.up || new THREE.Vector3(0, 1, 0);
    U[i * 3] = u.x;
    U[i * 3 + 1] = u.y;
    U[i * 3 + 2] = u.z;
    Sz[i] = g.size;
    Sd[i] = (i * 7.31 + g.pos.x * 91.7 + g.pos.z * 53.3) % 997;
  });
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3));
  geo.setAttribute('iUp', new THREE.InstancedBufferAttribute(U, 3));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(Sz, 1));
  geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(Sd, 1));
  geo.instanceCount = n;
  const lights = (
    o.lights || [
      new THREE.Vector3(0.3, 1, 0.5),
      new THREE.Vector3(-0.6, 0.8, 0.2),
      new THREE.Vector3(0.7, 0.6, -0.4),
      new THREE.Vector3(-0.2, 0.9, -0.7),
    ]
  ).map((v) => v.clone().normalize());
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pxPerUnit: { value: 800 },
      viewport: { value: new THREE.Vector2(800, 600) },
      gain: { value: o.gain == null ? 1 : o.gain },
      maxPx: { value: o.maxPx || 44 },
      minPx: { value: o.minPx || 5 },
      ortho: { value: 0 },
      lights: { value: lights },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.name = 'sparkle';
  /** Call before rendering: time in seconds, the camera and the drawing buffer size. */
  mesh.userData.update = (time, camera, w, h) => {
    mat.uniforms.time.value = time;
    mat.uniforms.viewport.value.set(w, h);
    if (camera.isOrthographicCamera) {
      mat.uniforms.ortho.value = 1;
      mat.uniforms.pxPerUnit.value = h / (camera.top - camera.bottom);
    } else {
      mat.uniforms.ortho.value = 0;
      mat.uniforms.pxPerUnit.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    }
  };
  mesh.userData.count = n;
  return mesh;
}
