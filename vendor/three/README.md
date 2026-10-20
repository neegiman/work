# Three.js

- Version: 0.186.1 (r186)
- Source: https://www.npmjs.com/package/three/v/0.186.1
- Upstream: https://github.com/mrdoob/three.js
- License: MIT; included in `LICENSE`.

The two minified ES modules are vendored so the posture viewer does not depend on a third-party CDN at runtime. In `three.module.min.js`, the relative reference `./three.core.js` is changed to the equivalent `./three.core.min.js` to use the minified core build. No other upstream code is changed.
