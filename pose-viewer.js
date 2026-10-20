import * as THREE from './vendor/three/three.module.min.js';
import { getPosture } from './posture-data.js?v=20261020-3d';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const vector = point => new THREE.Vector3(...point);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const move = (a, direction, distance) => a.map((value, i) => value + direction[i] * distance);

export function createPoseViewer(container, { onPlayback = () => {}, onStatus = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0xf2f5ed);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const canvas = renderer.domElement;
  canvas.id = 'pose-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-describedby', 'pose-interaction-hint');
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.15, 2.15, 1.35, -1.35, 0.1, 30);
  const target = new THREE.Vector3(0, 0.35, 0);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xa5b793, 2.3);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff7e8, 3.2);
  sun.position.set(0.5, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -2.8;
  sun.shadow.camera.right = sun.shadow.camera.top = 2.8;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe8f2ff, 1.2);
  fill.position.set(-3, 2, -3);
  scene.add(fill);

  const material = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
  const materials = {
    skin: material(0xd9c5af), shirt: material(0x72936d), shorts: material(0x3e514b),
    shoes: material(0xeeeee3), sole: material(0xc2ccbc), eyes: material(0x4a5043),
  };
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  const body = new THREE.Group(); scene.add(body);
  function mesh(geometry, mat, parent = body) {
    const part = new THREE.Mesh(geometry, mat);
    part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
  }
  function ball(mat = materials.skin) { return mesh(sphere, mat); }
  function bone(mat = materials.skin) { return mesh(cylinder, mat); }
  function position(part, point, size) {
    part.position.set(...point);
    if (typeof size === 'number') part.scale.setScalar(size); else part.scale.set(...size);
  }
  function segment(part, a, b, radius) {
    const delta = vector(b).sub(vector(a));
    part.position.copy(vector(a).add(vector(b)).multiplyScalar(0.5));
    part.quaternion.setFromUnitVectors(Y_AXIS, delta.clone().normalize());
    part.scale.set(radius, delta.length(), radius);
  }
  function ellipsoid(part, point, direction, size) {
    position(part, point, size);
    part.quaternion.setFromUnitVectors(Y_AXIS, vector(direction).normalize());
  }

  const torso = ball(materials.shirt), waist = ball(materials.shirt), pelvis = ball(materials.shorts);
  const neck = bone(), head = ball(), nose = ball();
  const eyes = [ball(materials.eyes), ball(materials.eyes)];
  const ears = [ball(), ball()];
  const limbs = [-1, 1].map(() => ({
    upperArm: bone(), lowerArm: bone(), shoulder: ball(materials.shirt), elbow: ball(), wrist: ball(),
    hand: ball(), thigh: bone(), shorts: bone(materials.shorts), calf: bone(),
    knee: ball(), hip: ball(materials.shorts), ankle: ball(), shoe: ball(materials.shoes), sole: ball(materials.sole),
  }));

  // Rounded training mat, lying in the ground plane.
  const shape = new THREE.Shape();
  const width = 3.35, height = 1.35, corner = 0.13;
  shape.moveTo(-width / 2 + corner, -height / 2);
  shape.lineTo(width / 2 - corner, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + corner);
  shape.lineTo(width / 2, height / 2 - corner);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - corner, height / 2);
  shape.lineTo(-width / 2 + corner, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - corner);
  shape.lineTo(-width / 2, -height / 2 + corner);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + corner, -height / 2);
  const mat = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.008, bevelSegments: 3, steps: 1 }), material(0xd9e4cf), scene);
  mat.rotation.x = -Math.PI / 2; mat.position.y = 0.016; mat.receiveShadow = true; mat.castShadow = false;
  const floor = mesh(new THREE.PlaneGeometry(20, 20), material(0xf2f5ed), scene);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.castShadow = false;
  const grid = new THREE.GridHelper(8, 32, 0xe0e7d7, 0xe5ebde);
  grid.position.y = -0.006; grid.material.transparent = true; grid.material.opacity = 0.75; scene.add(grid);

  const alignmentGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const alignment = new THREE.Line(alignmentGeometry, new THREE.LineDashedMaterial({ color: 0x97b778, dashSize: 0.065, gapSize: 0.035, transparent: true, opacity: 0.8, depthTest: false }));
  alignment.renderOrder = 2; scene.add(alignment);
  const markers = [1, 2, 3].map(number => {
    const image = document.createElement('canvas'); image.width = image.height = 96;
    const context = image.getContext('2d');
    context.beginPath(); context.arc(48, 48, 35, 0, Math.PI * 2); context.fillStyle = '#f7faef'; context.fill();
    context.lineWidth = 5; context.strokeStyle = '#91ac76'; context.stroke();
    context.fillStyle = '#5a7444'; context.font = 'bold 38px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(String(number), 48, 49);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.setScalar(0.23); sprite.renderOrder = 3; scene.add(sprite); return sprite;
  });

  let exercise = 'plank', active = false, playing = false, cycle = 0, yaw = 0.4, elevation = 0.4;
  let frame = 0, previousTime = 0, previousDraw = 0, pointer = null;
  function updatePose(depth) {
    const pose = getPosture(exercise, depth), { direction, hip, shoulder } = pose;
    ellipsoid(torso, mix(hip, shoulder, 0.63), direction, [0.145, 0.40, 0.245]);
    ellipsoid(waist, mix(hip, shoulder, 0.23), direction, [0.135, 0.24, 0.185]);
    ellipsoid(pelvis, move(hip, direction, -0.055), direction, [0.15, 0.22, 0.195]);
    segment(neck, move(shoulder, direction, 0.13), move(shoulder, direction, 0.26), 0.07);
    ellipsoid(head, pose.head, direction, [0.143, 0.177, 0.143]);
    const face = [direction[1], -direction[0], 0];
    position(nose, move(move(pose.head, face, 0.143), direction, 0.015), [0.03, 0.035, 0.027]);
    [-1, 1].forEach((side, index) => {
      const limb = limbs[index], joints = pose.sides[index];
      segment(limb.upperArm, joints.shoulder, joints.elbow, 0.071);
      segment(limb.lowerArm, joints.elbow, joints.wrist, 0.061);
      position(limb.shoulder, joints.shoulder, 0.086);
      position(limb.elbow, joints.elbow, 0.072); position(limb.wrist, joints.wrist, 0.047);
      position(limb.hand, joints.hand, [0.12, 0.035, 0.067]);
      segment(limb.thigh, joints.hip, joints.knee, 0.097);
      segment(limb.shorts, joints.hip, mix(joints.hip, joints.knee, 0.55), 0.104);
      segment(limb.calf, joints.knee, joints.ankle, 0.071);
      position(limb.knee, joints.knee, 0.081); position(limb.hip, joints.hip, 0.109);
      position(limb.ankle, joints.ankle, 0.055);
      const footDirection = vector(joints.toe).sub(vector(joints.ankle)).normalize().toArray();
      ellipsoid(limb.shoe, mix(joints.ankle, joints.toe, 0.57), footDirection, [0.065, 0.13, 0.07]);
      ellipsoid(limb.sole, move(mix(joints.ankle, joints.toe, 0.57), [0, -1, 0], 0.025), footDirection, [0.066, 0.13, 0.072]);
      position(eyes[index], [pose.head[0] + direction[0] * 0.06 + face[0] * 0.13, pose.head[1] + direction[1] * 0.06 + face[1] * 0.13, side * 0.055], 0.012);
      position(ears[index], [pose.head[0], pose.head[1], side * 0.141], [0.026, 0.04, 0.018]);
    });
    const attribute = alignmentGeometry.getAttribute('position');
    const start = move(pose.sides[1].ankle, face, -0.1);
    const end = move(pose.head, face, -0.1);
    start[2] += 0.13; end[2] = start[2];
    attribute.setXYZ(0, ...start); attribute.setXYZ(1, ...end); attribute.needsUpdate = true;
    alignment.computeLineDistances(); alignmentGeometry.computeBoundingSphere();
    markers.forEach((marker, index) => marker.position.set(...pose.markers[index]));
    canvas.dataset.depth = depth.toFixed(3);
  }

  function cameraPosition() {
    const radius = 6;
    camera.position.set(Math.sin(yaw) * Math.cos(elevation) * radius, target.y + Math.sin(elevation) * radius, Math.cos(yaw) * Math.cos(elevation) * radius);
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
    const halfWidth = 1.05 + 0.73 * Math.abs(Math.cos(yaw)), halfHeight = halfWidth * height / width;
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
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
    if (event.key === 'Home') { yaw = 0.4; elevation = 0.4; }
    else if (event.key === 'ArrowLeft') yaw -= 0.15;
    else if (event.key === 'ArrowRight') yaw += 0.15;
    else elevation = Math.max(0.1, Math.min(1.05, elevation + (event.key === 'ArrowUp' ? 0.1 : -0.1)));
    cameraPosition(); requestDraw();
  });
  document.addEventListener('visibilitychange', () => { previousTime = 0; if (document.visibilityState === 'visible') requestDraw(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); onStatus('3D 화면을 복구하고 있어요.'); });
  canvas.addEventListener('webglcontextrestored', () => { onStatus(''); requestDraw(); });

  cameraPosition(); updatePose(0); resize();
  return {
    setExercise(id) {
      exercise = id; playing = false; cycle = 0; previousTime = 0;
      yaw = 0.4; elevation = 0.4; cameraPosition(); updatePose(0);
      canvas.setAttribute('aria-label', `${id === 'plank' ? '플랭크' : '팔굽혀펴기'} 3D 자세. 좌우 방향키로 회전, 위아래 방향키로 시점 조절, Home으로 초기화.`);
      onPlayback({ playing: false, depth: 0, phase: id === 'plank' ? '기본 자세' : '시작 자세' }); requestDraw();
    },
    setActive(value) {
      active = value; previousTime = 0;
      if (!active) { playing = false; cancelAnimationFrame(frame); frame = 0; }
      else { resize(); requestDraw(); }
    },
    setView(view) {
      [yaw, elevation] = view === 'side' ? [0, 0.14] : view === 'front' ? [Math.PI / 2, 0.25] : [0.4, 0.4];
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
