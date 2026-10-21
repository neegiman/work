# PACE reference athlete v3

`pace-athlete-v3.glb` is a real 3D surface model with embedded textures and two morph targets: pushup start and bottom. The default mesh is the forearm plank. It is built to reflect the proportions, sage tee, charcoal shorts, ivory trainers, and warm studio palette of the approved concept images. It is a manually fitted model derived from mesh assets, not an automatic reconstruction of the photographed person.

The viewer displays three static poses. Dragging and keyboard controls orbit the camera. It renders only after a pose, view, visibility, or size change.

## Sources

Anatomy, Asian male and muscle targets, rig reference data, and weights: [MakeHuman](https://github.com/makehumancommunity/makehuman). Hair `short01`, trainers `shoes05`, the pants mesh from `male_casualsuit04`, eyes, and skin: [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html). Tee: `elvs_crude_t-shirt_male` by MakeHuman / Elvaerwyn, from [Shirts 01](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html).

These graphical assets are released under [CC0](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md); the statement is included as `LICENSE.ASSETS.md`. No MakeHuman program code is included. Three.js and its GLTFLoader have their MIT license in `vendor/three/`.

## Build

The source project contains `tools/build-athlete.py`. It applies the anatomy targets, transfers garment weights from barycentric references, fits each pose, removes covered skin and helpers, clips the shorts hem, and exports the GLB with normal and position morph targets. Source downloads stay in the ignored `model-sources/` folder. Runtime model size is about 3.4 MB; no third-party model service is called by the site.
