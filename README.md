# tsl-2dkit

A TypeScript library serving as a toolkit to be used on top of [Three.js Shading Language (TSL)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) for 2D shaders.

tsl-2dkit is thought out to be an accessible way to write (and learn) fragment shader programming. It lives on top of TSL, which's toolchain transpiles JavaScript code (TSL syntax) to WebGL or WebGPU, allowing for native-speed fragment shaders with minimal overhead.

## Features

- [A scene handler](src/core/TSLScene2D.ts), for writing fragment-shaders in a canvas-like manner, greatly reducing boilerplate
- Write TSL shaders as a [PassNode](https://threejs.org/docs/#PassNode) (scene post-processing)

### Utilities

- A texture handler, allowing for non-TSL based reactive textures such as [videos and images](src/textures/MediaTexture.ts), [updatable text](src/textures/TextTexture.ts), [external canvases](src/textures/CanvasTexture.ts) and more.
- A [canvas recorder](src/time/CanvasRecorder.ts), allowing to easily save the canvas as a framerate-consistent video
- [Better noise algorithms](src/noises) (than the native TSL ones), such as [Voronoi](src/noises/voronoi.ts) (more to be implemented)
- [Blur algorithms](src/blur/blur.ts), [morphology algorithms](src/filters/morphology.ts),

## Installation

```bash
npm install tsl-2dkit three
# or
pnpm add tsl-2dkit three
# or
bun install tsl-2dkit three
# ...
```

## Quick Start

```typescript
import { color } from "three/tsl";
import { TSLScene2D } from "tsl-2dkit";

const scene = new TSLScene2D(window.innerWidth, window.innerHeight);

window.addEventListener("resize", () => {
	scene.setSize(window.innerWidth, window.innerHeight);
});

await scene.build(() => {
	const final = color("#ff8c00");
	return final;
});

document.body.appendChild(scene.canvasElement);
```

## Documentation

Coming soon! For now, check out the demo folder for examples. All public API is _theorically_ documented.

Also see:

- [Three.js Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) (GitHub wiki)
- [Official TSL nodes documentation](https://threejs.org/docs/#TSL)

## Requirements

- Three.js v0.182.0 or higher
- Modern browser with WebGPU or WebGL2 support

## License

MPL-2.0

## Contributing

This library is in alpha. Contributions and feedback are welcome!

## Thanks

- [The three.js and TSL authors and contributors](https://github.com/mrdoob/three.js/graphs/contributors), without which's hard work this project wouldn't have been possible
- [Prof. David Liebermann](https://www.burg-halle.de/en/person/p/david-liebermann) and [Prof. Jana Reddemann](https://www.burg-halle.de/en/person/p/jana-reddemann) for giving Sacha, author, the libery to work on this library as a main semester project as part of his [visual and graphic communication bachelor](https://lacambre.be/en/courses/visual-and-graphic-communication)
- [p5.js](https://p5js.org/), [Processing](https://processing.org/), [the Coding Train and Daniel Shiffman](https://thecodingtrain.com/) and [Tim Rodenbröker](https://youtu.be/SKDhkB8g1So) for making coding accessible via creative coding, one of the inspirations behind this project
