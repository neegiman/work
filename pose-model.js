import * as THREE from './vendor/three/three.module.min.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const vector = point => new THREE.Vector3(...point);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const move = (a, direction, distance) => a.map((value, i) => value + direction[i] * distance);

// Elliptical cross sections give the torso and limbs a continuous silhouette.
// Each section is [height, front/back radius, left/right radius].
function contourGeometry(sections, rings = 40, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(sections.map(([y, x, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
  const positions = [], indices = [];
  for (let ring = 0; ring <= rings; ring++) {
    const section = curve.getPoint(ring / rings);
    for (let side = 0; side <= segments; side++) {
      const angle = side / segments * Math.PI * 2;
      positions.push(Math.cos(angle) * section.x, section.y, Math.sin(angle) * section.z);
      if (ring < rings && side < segments) {
        const a = ring * (segments + 1) + side, b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // Average seam normals so a lighting seam does not appear on the body.
  const normals = geometry.getAttribute('normal');
  for (let ring = 0; ring <= rings; ring++) {
    const first = ring * (segments + 1), last = first + segments;
    const normal = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

export function createAthlete() {
  const group = new THREE.Group(); group.name = 'PACE athlete';
  const material = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const materials = {
    skin: material(0xc68f6d, 0.88), shirt: material(0x365e55), shorts: material(0x293e3c),
    shoes: material(0xe5e7de), sole: material(0xaebdb2), hair: material(0x302f2b),
    eyes: material(0x322c27),
  };
  const sphere = new THREE.SphereGeometry(1, 24, 18);
  const limbGeometry = contourGeometry([
    [-0.52, 0.03, 0.03], [-0.47, 0.7, 0.7], [-0.28, 1, 1],
    [0.1, 0.92, 0.92], [0.39, 0.7, 0.7], [0.5, 0.55, 0.55], [0.52, 0.03, 0.03],
  ], 24, 20);
  function mesh(geometry, mat, parent = group) {
    const part = new THREE.Mesh(geometry, mat); part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
  }
  function ball(mat = materials.skin, parent = group) { return mesh(sphere, mat, parent); }
  function bone(mat = materials.skin) { return mesh(limbGeometry, mat); }
  function position(part, point, size) {
    part.position.set(...point);
    if (typeof size === 'number') part.scale.setScalar(size); else part.scale.set(...size);
  }
  function orient(part, direction) { part.quaternion.setFromUnitVectors(Y_AXIS, vector(direction).normalize()); }
  function segment(part, a, b, radius) {
    const delta = vector(b).sub(vector(a));
    part.position.copy(vector(a).add(vector(b)).multiplyScalar(0.5));
    part.quaternion.setFromUnitVectors(Y_AXIS, delta.clone().normalize());
    part.scale.set(radius, delta.length(), radius);
  }
  const torso = mesh(contourGeometry([
    [-0.1, 0.02, 0.025], [-0.05, 0.105, 0.15], [0.08, 0.115, 0.16],
    [0.23, 0.105, 0.165], [0.42, 0.13, 0.2], [0.63, 0.145, 0.24],
    [0.77, 0.12, 0.235], [0.85, 0.09, 0.17], [0.91, 0.055, 0.075], [0.93, 0.01, 0.02],
  ]), materials.shirt);
  const pelvis = ball(materials.shorts), neck = bone();
  const head = new THREE.Group(); group.add(head);
  mesh(contourGeometry([
    [-0.17, 0.025, 0.035], [-0.135, 0.077, 0.085], [-0.06, 0.106, 0.112],
    [0.035, 0.119, 0.125], [0.115, 0.101, 0.112], [0.17, 0.045, 0.052], [0.18, 0.003, 0.003],
  ], 32), materials.skin, head);
  const hair = ball(materials.hair, head); position(hair, [-0.052, 0.028, 0], [0.083, 0.153, 0.127]);
  const crown = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.38), materials.hair, head);
  position(crown, [-0.008, 0.012, 0], [0.123, 0.172, 0.13]);
  const nose = ball(materials.skin, head); position(nose, [0.119, -0.015, 0], [0.033, 0.035, 0.023]);
  for (const side of [-1, 1]) {
    const eye = ball(materials.eyes, head); position(eye, [0.108, 0.042, side * 0.049], [0.008, 0.007, 0.012]);
    const ear = ball(materials.skin, head); position(ear, [-0.015, -0.006, side * 0.124], [0.024, 0.034, 0.015]);
  }
  const limbs = [-1, 1].map(side => {
    const hand = new THREE.Group(); group.add(hand);
    const palm = ball(materials.skin, hand); position(palm, [0, 0, 0], [0.075, 0.028, 0.052]);
    for (let finger = 0; finger < 4; finger++) {
      const part = ball(materials.skin, hand);
      position(part, [0.07 + (finger === 0 || finger === 3 ? -0.008 : 0), -0.009, (finger - 1.5) * 0.026], [0.047, 0.015, 0.012]);
    }
    const thumb = ball(materials.skin, hand); position(thumb, [0.005, -0.007, -side * 0.067], [0.046, 0.018, 0.019]);
    thumb.rotation.y = -side * 0.6;
    return {
      upperArm: bone(), lowerArm: bone(), shoulder: ball(materials.shirt), sleeve: bone(materials.shirt), elbow: ball(), wrist: ball(), hand,
      thigh: bone(), shorts: bone(materials.shorts), knee: ball(), calf: bone(), ankle: ball(),
      shoe: ball(materials.shoes), sole: ball(materials.sole), heel: ball(materials.shorts),
    };
  });
  function update(pose) {
    const { direction, hip, shoulder } = pose;
    torso.position.set(...hip); orient(torso, direction);
    position(pelvis, move(hip, direction, -0.045), [0.12, 0.17, 0.165]); orient(pelvis, direction);
    segment(neck, move(shoulder, direction, 0.09), move(shoulder, direction, 0.28), 0.06);
    head.position.set(...pose.head); orient(head, direction);
    limbs.forEach((limb, index) => {
      const joints = pose.sides[index];
      segment(limb.upperArm, joints.shoulder, joints.elbow, 0.081);
      segment(limb.sleeve, joints.shoulder, mix(joints.shoulder, joints.elbow, 0.39), 0.092);
      segment(limb.lowerArm, joints.elbow, joints.wrist, 0.063);
      position(limb.shoulder, joints.shoulder, 0.092); position(limb.elbow, joints.elbow, 0.057);
      position(limb.wrist, joints.wrist, 0.037); limb.hand.position.set(...joints.hand);
      segment(limb.thigh, joints.hip, joints.knee, 0.108);
      segment(limb.shorts, joints.hip, mix(joints.hip, joints.knee, 0.57), 0.118);
      position(limb.knee, joints.knee, 0.067); segment(limb.calf, joints.knee, joints.ankle, 0.077);
      position(limb.ankle, joints.ankle, 0.045);
      const footDirection = vector(joints.toe).sub(vector(joints.ankle)).normalize().toArray();
      position(limb.shoe, mix(joints.ankle, joints.toe, 0.5), [0.057, 0.116, 0.059]); orient(limb.shoe, footDirection);
      position(limb.sole, move(mix(joints.ankle, joints.toe, 0.5), [-1, -0.12, 0], 0.031), [0.027, 0.116, 0.06]); orient(limb.sole, footDirection);
      position(limb.heel, mix(joints.ankle, joints.toe, 0.14), [0.048, 0.048, 0.06]);
    });
    group.updateMatrixWorld(true);
  }
  return { group, update };
}

export function framePoseCamera(camera, bounds, aspect) {
  camera.updateMatrixWorld(true);
  let horizontal = 0, vertical = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    horizontal = Math.max(horizontal, Math.abs(point.x)); vertical = Math.max(vertical, Math.abs(point.y));
  }
  const halfHeight = Math.max(vertical, horizontal / aspect, 0.35) * 1.13;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
}
