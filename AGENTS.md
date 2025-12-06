You are able to use the Context7 MCP Server, where you can find relevant documentation for libraries used in this project, such as:

- three.js: websites/threejs

Project specification:

- `three/tsl`, aka `Three.js Shading Language`, is a part of the `three.js` library focused on writing JS code that gets compiled to WebGPU/WebGL, allowing for easy to write shaders.
- This codebase, `three-tsl-lab` is a library to complement `three/tsl` in 2D-based shaders. Its goal is to have a streamline, type-safe user experience, with numerous utilities such as a scene handler, easy dynamic textures management (such as interactive text, videos, etc), and more.
- The codebase is very strict, and should remain like that. The tech stack is `pnpm`, `typescript`, `three`, as well as other helper, less important libraries.

Notes:

1. The three.js documentation is often incomplete, and you will have to search through the three.js source files using `find` or `rg` in terminal, as your `regex` command doesn't allow to search in `node_modules`.
2. `three-tsl-lab` is currently unpublished and in early alpha. No changes made to the project should be backwards-compatible.
