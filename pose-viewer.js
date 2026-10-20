import * as THREE from './vendor/three/three.module.min.js';
import { getPosture } from './posture-data.js?v=20261020-3d';
import { createAthlete, framePoseCamera } from './pose-model.js?v=20261020-athlete';

const move = (a, direction, distance) => a.map((value, i) => value + direction[i] * distance);

export function createPoseViewer(container, { onPlayback = () => {}, onStatus = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0xf1f3ed);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const canvas = renderer.domElement;
  canvas.id = 'pose-canvas';
  canvas.dataset.model = 'athlete-v2';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-describedby', 'pose-interaction-hint');
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.15, 2.15, 1.35, -1.35, 0.1, 30);
  const target = new THREE.Vector3(0, 0.4, 0);
  const bounds = new THREE.Box3();
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x96a58d, 1.7);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff1df, 2.6);
  sun.position.set(-1.5, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -2.8;
  sun.shadow.camera.right = sun.shadow.camera.top = 2.8;
  sun.shadow.radius = 3;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdce9ff, 0.9);
  fill.position.set(-3, 2, -3);
  scene.add(fill);

  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const athlete = createAthlete(); scene.add(athlete.group);
  function mesh(geometry, mat, parent = scene) {
    const part = new THREE.Mesh(geometry, mat);
    part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
  }

  // Rounded training mat, lying in the ground plane.
  const shape = new THREE.Shape();
  const width = 3.55, height = 1.45, corner = 0.13;
  shape.moveTo(-width / 2 + corner, -height / 2);
  shape.lineTo(width / 2 - corner, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + corner);
  shape.lineTo(width / 2, height / 2 - corner);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - corner, height / 2);
  shape.lineTo(-width / 2 + corner, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - corner);
  shape.lineTo(-width / 2, -height / 2 + corner);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + corner, -height / 2);
  const mat = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.008, bevelSegments: 3, steps: 1 }), material(0xc9d6c4));
  mat.rotation.x = -Math.PI / 2; mat.position.y = 0.016; mat.receiveShadow = true; mat.castShadow = false;
  const floor = mesh(new THREE.PlaneGeometry(20, 20), material(0xf1f3ed));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.castShadow = false;
  // A faint contact shadow grounds the model without a costly postprocessing pass.
  const shadowImage = document.createElement('canvas'); shadowImage.width = 256; shadowImage.height = 128;
  const shadowContext = shadowImage.getContext('2d');
  shadowContext.scale(2, 1);
  const gradient = shadowContext.createRadialGradient(64, 64, 6, 64, 64, 63);
  gradient.addColorStop(0, '#314b3938'); gradient.addColorStop(1, '#314b3900');
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.95), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowImage), transparent: true, depthWrite: false }));
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.position.y = 0.043; scene.add(contactShadow);

  const alignmentGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const alignment = new THREE.Line(alignmentGeometry, new THREE.LineDashedMaterial({ color: 0x83a765, dashSize: 0.065, gapSize: 0.035, transparent: true, opacity: 0.8, depthTest: false }));
  alignment.renderOrder = 2; scene.add(alignment);
  const markers = [1, 2, 3].map(number => {
    const image = document.createElement('canvas'); image.width = image.height = 96;
    const context = image.getContext('2d');
    context.beginPath(); context.arc(48, 48, 35, 0, Math.PI * 2); context.fillStyle = '#fafcf5'; context.fill();
    context.lineWidth = 5; context.strokeStyle = '#78965b'; context.stroke();
    context.fillStyle = '#456236'; context.font = 'bold 38px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(number), 48, 49);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.setScalar(0.23); sprite.renderOrder = 3; scene.add(sprite); return sprite;
  });

  let exercise = 'plank', active = false, playing = false, cycle = 0, yaw = 0.42, elevation = 0.32;
  let frame = 0, previousTime = 0, previousDraw = 0, pointer = null;
  function updatePose(depth) {
    const pose = getPosture(exercise, depth);
    athlete.update(pose);
    const face = [pose.direction[1], -pose.direction[0], 0];
    const attribute = alignmentGeometry.getAttribute('position');
    const start = move(pose.sides[1].ankle, face, -0.18);
    const end = move(pose.head, face, -0.18);
    start[2] += 0.13; end[2] = start[2];
    attribute.setXYZ(0, ...start); attribute.setXYZ(1, ...end); attribute.needsUpdate = true;
    alignment.computeLineDistances(); alignmentGeometry.computeBoundingSphere();
    markers.forEach((marker, index) => marker.position.set(...pose.markers[index]));
    canvas.dataset.depth = depth.toFixed(3);
  }

  function measureMotion() {
    bounds.makeEmpty();
    for (const depth of exercise === 'pushup' ? [0, 0.5, 1] : [0]) {
      updatePose(depth); bounds.union(new THREE.Box3().setFromObject(athlete.group));
      getPosture(exercise, depth).markers.forEach(point => bounds.expandByPoint(new THREE.Vector3(...point)));
    }
    bounds.expandByScalar(0.1); bounds.getCenter(target);
    updatePose(0);
  }

  function cameraPosition() {
    const radius = 6;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(elevation) * radius, target.y + Math.sin(elevation) * radius, target.z + Math.cos(yaw) * Math.cos(elevation) * radius);
    camera.lookAt(target);
    projectCamera();
    canvas.dataset.yaw = yaw.toFixed(3); canvas.dataset.elevation = elevation.toFixed(3);
  }
  function draw(time) {
    frame = 0;
    if (!active || document.visibilityState !== 'visible') return;
    if (playing && time - previousDraw < 32) { frame = requestAnimationFrame(draw); return; }
    if (playing) {
      cycle = (cycle + Math.min(time - (previousTime || time), 100) / 4400) % 1;
      const depth = 0.5 - Math.cos(cycle * Math.PI * 2) * 0.5;
      updatePose(depth);
      onPlayback({ playing, depth, phase: cycle < 0.04 || cycle > 0.96 ? '시작 자세' : cycle < 0.45 ? '내려가는 중' : cycle < 0.55 ? '내려간 자세' : '올라오는 중' });
    }
    previousTime = time; previousDraw = time;
    renderer.render(scene, camera);
    if (playing) frame = requestAnimationFrame(draw);
  }
  function requestDraw() { if (active && !frame) frame = requestAnimationFrame(draw); }
  function resize() {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    projectCamera(); requestDraw();
  }
  function projectCamera() {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    framePoseCamera(camera, bounds, width / height);
  }
  new ResizeObserver(resize).observe(container);
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    yaw -= (event.clientX - pointer.x) * 0.012;
    if (event.pointerType !== 'touch') elevation = Math.max(0.1, Math.min(1.05, elevation + (event.clientY - pointer.y) * 0.008));
    pointer.x = event.clientX; pointer.y = event.clientY;
    cameraPosition(); requestDraw();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { pointer = null; });
  canvas.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') { yaw = 0.42; elevation = 0.32; }
    else if (event.key === 'ArrowLeft') yaw -= 0.15;
    else if (event.key === 'ArrowRight') yaw += 0.15;
    else elevation = Math.max(0.1, Math.min(1.05, elevation + (event.key === 'ArrowUp' ? 0.1 : -0.1)));
    cameraPosition(); requestDraw();
  });
  document.addEventListener('visibilitychange', () => { previousTime = 0; if (document.visibilityState === 'visible') requestDraw(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onStatus('3D 화면을 복구하고 있어요.'); });
  canvas.addEventListener('webglcontextrestored', () => { onStatus(''); requestDraw(); });

  measureMotion(); cameraPosition(); resize();
  return {
    setExercise(id) {
      exercise = id; playing = false; cycle = 0; previousTime = 0;
      yaw = 0.42; elevation = 0.32; measureMotion(); cameraPosition();
      canvas.setAttribute('aria-label', `${id === 'plank' ? '플랭크' : '팔굽혀펴기'} 3D 자세. 좌우 방향키로 회전, 위아래 방향키로 시점 조절, Home으로 초기화.`);
      onPlayback({ playing: false, depth: 0, phase: id === 'plank' ? '기본 자세' : '시작 자세' }); requestDraw();
    },
    setActive(value) {
      active = value; previousTime = 0;
      if (!active) { playing = false; cancelAnimationFrame(frame); frame = 0; }
      else { resize(); requestDraw(); }
    },
    setView(view) {
      [yaw, elevation] = view === 'side' ? [0, 0.14] : view === 'front' ? [Math.PI / 2, 0.25] : [0.42, 0.32];
      cameraPosition(); requestDraw();
    },
    setDepth(depth) {
      playing = false; cycle = depth >= 0.5 ? 0.5 : 0;
      updatePose(depth); onPlayback({ playing, depth, phase: depth >= 0.5 ? '내려간 자세' : '시작 자세' }); requestDraw();
    },
    togglePlayback() {
      if (exercise !== 'pushup') return;
      playing = !playing; previousTime = 0;
      onPlayback({ playing, depth: 0.5 - Math.cos(cycle * Math.PI * 2) * 0.5, phase: playing ? '동작 시범' : '멈춤' }); requestDraw();
    },
  };
}
