import * as THREE from './vendor/three/three.module.min.js';
import { createAthlete, framePoseCamera } from './pose-model.js?v=20261021-reference-3d2';

export async function createPoseViewer(container, { onPlayback = () => {}, onStatus = () => {} } = {}) {
  const athlete = await createAthlete();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xeee9e2);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.id = 'pose-canvas'; canvas.dataset.model = 'reference-athlete-v3'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-describedby', 'pose-interaction-hint');
  container.append(canvas);
  const scene = new THREE.Scene(); scene.add(athlete.group);
  const camera = new THREE.OrthographicCamera(-2, 2, 1.35, -1.35, 0.1, 30);
  const target = new THREE.Vector3(), bounds = new THREE.Box3();
  scene.add(new THREE.HemisphereLight(0xfffcf7, 0xa99f90, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e8, 2.8);
  sun.position.set(-1, 4.5, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -2.2;
  sun.shadow.camera.right = sun.shadow.camera.top = 2.2;
  sun.shadow.camera.near = .1; sun.shadow.camera.far = 12;
  sun.shadow.normalBias = .012; sun.shadow.bias = -.00015; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe9efff, .7);
  fill.position.set(2, 2, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff9ec, .8);
  rim.position.set(-3, 2, -1); scene.add(rim);

  const shape = new THREE.Shape();
  const width = 3.05, height = .95, corner = .06;
  shape.moveTo(-width / 2 + corner, -height / 2); shape.lineTo(width / 2 - corner, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + corner);
  shape.lineTo(width / 2, height / 2 - corner); shape.quadraticCurveTo(width / 2, height / 2, width / 2 - corner, height / 2);
  shape.lineTo(-width / 2 + corner, height / 2); shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - corner);
  shape.lineTo(-width / 2, -height / 2 + corner); shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + corner, -height / 2);
  const mat = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .016, bevelEnabled: true, bevelSize: .012, bevelThickness: .008, bevelSegments: 3, steps: 1 }), new THREE.MeshStandardMaterial({ color: 0x979f87, roughness: .98 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(-.08, .016, 0); mat.receiveShadow = true; scene.add(mat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xeee9e2, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; floor.receiveShadow = true; scene.add(floor);
  const shadowImage = document.createElement('canvas'); shadowImage.width = 256; shadowImage.height = 128;
  const context = shadowImage.getContext('2d'); context.scale(2, 1);
  const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 63);
  gradient.addColorStop(0, '#423d342d'); gradient.addColorStop(1, '#423d3400');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, .8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowImage), transparent: true, depthWrite: false }));
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.y = .043; scene.add(contactShadow);

  let exercise = 'plank', depth = 0, active = false, contextLost = false;
  let yaw = .16, elevation = .16, frame = 0, pointer = null;
  function updatePose(value) {
    depth = Math.max(0, Math.min(1, Number(value) || 0)); athlete.update(exercise, depth);
    canvas.dataset.depth = depth.toFixed(3);
    onPlayback({ playing: false, depth, phase: exercise === 'plank' ? '기본 자세' : depth >= .5 ? '내려간 자세' : '시작 자세' });
  }
  function measure() {
    bounds.makeEmpty();
    athlete.update(exercise, depth); bounds.union(new THREE.Box3().setFromObject(athlete.group, true));
    bounds.expandByScalar(.05);
    bounds.expandByPoint(new THREE.Vector3(-1.62, .02, -.48)); bounds.expandByPoint(new THREE.Vector3(1.46, .03, .48));
    bounds.getCenter(target); athlete.update(exercise, depth);
  }
  function projectCamera() {
    framePoseCamera(camera, bounds, Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1));
  }
  function cameraPosition() {
    const radius = 6;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(elevation) * radius, target.y + Math.sin(elevation) * radius, target.z + Math.cos(yaw) * Math.cos(elevation) * radius);
    camera.lookAt(target); projectCamera(); canvas.dataset.yaw = yaw.toFixed(3); canvas.dataset.elevation = elevation.toFixed(3);
  }
  function draw() {
    frame = 0;
    if (active && !contextLost && document.visibilityState === 'visible') renderer.render(scene, camera);
  }
  function requestDraw() { if (active && !contextLost && !frame) frame = requestAnimationFrame(draw); }
  function resize() {
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false); projectCamera(); requestDraw();
  }
  new ResizeObserver(resize).observe(container);
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    yaw -= (event.clientX - pointer.x) * .012;
    if (event.pointerType !== 'touch') elevation = Math.max(.08, Math.min(1.05, elevation + (event.clientY - pointer.y) * .008));
    pointer.x = event.clientX; pointer.y = event.clientY; cameraPosition(); requestDraw();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { pointer = null; });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') { yaw = .16; elevation = .16; }
    else if (event.key === 'ArrowLeft') yaw -= .15;
    else if (event.key === 'ArrowRight') yaw += .15;
    else elevation = Math.max(.08, Math.min(1.05, elevation + (event.key === 'ArrowUp' ? .1 : -.1)));
    cameraPosition(); requestDraw();
  });
  document.addEventListener('visibilitychange', requestDraw);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; onStatus('3D 화면을 복구하고 있어요.'); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; onStatus(''); requestDraw(); });
  updatePose(0); measure(); cameraPosition(); resize();
  return {
    setExercise(id) {
      exercise = id; depth = 0; yaw = .16; elevation = .16; updatePose(0); measure(); cameraPosition();
      canvas.setAttribute('aria-label', `${id === 'plank' ? '플랭크' : '팔굽혀펴기'} 3D 자세. 좌우 방향키로 회전, 위아래 방향키로 시점 조절, Home으로 초기화.`); requestDraw();
    },
    setActive(value) {
      active = value;
      if (!active) { cancelAnimationFrame(frame); frame = 0; }
      else { resize(); requestDraw(); }
    },
    setView(view) {
      [yaw, elevation] = view === 'side' ? [0, .1] : view === 'front' ? [Math.PI / 2, .2] : [.48, .28]; cameraPosition(); requestDraw();
    },
    setDepth(value) { updatePose(value); measure(); cameraPosition(); requestDraw(); },
  };
}
