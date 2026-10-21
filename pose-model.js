import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

export async function createAthlete() {
  const gltf = await new GLTFLoader().loadAsync(new URL('./assets/athlete/pace-athlete-v3.glb', import.meta.url).href);
  const group = gltf.scene;
  group.name = 'PACE reference athlete';
  const meshes = [];
  group.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = true; part.receiveShadow = true; part.frustumCulled = false;
    meshes.push(part);
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const material of materials) {
      if (material.map) material.map.anisotropy = 4;
      if (material.name === 'Short dark hair') material.alphaToCoverage = true;
      if (material.name === 'Ivory trainers') material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.79, 0.77, 0.72), 0.65);');
      };
    }
  });
  function update(exercise, depth = 0) {
    const amount = Math.max(0, Math.min(1, Number(depth) || 0));
    for (const mesh of meshes) {
      if (!mesh.morphTargetInfluences) continue;
      mesh.morphTargetInfluences[0] = exercise === 'pushup' ? 1 - amount : 0;
      mesh.morphTargetInfluences[1] = exercise === 'pushup' ? amount : 0;
    }
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
  const halfHeight = Math.max(vertical, horizontal / aspect, 0.35) * 1.1;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
}
