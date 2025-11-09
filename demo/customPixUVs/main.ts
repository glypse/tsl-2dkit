import "$demo/style.css";

import { Canvas2D, textNode } from "$lib";
import { uv, uniform, vec2, floor, texture } from "three/tsl";

const canvas = new Canvas2D(800, 800);

await canvas.draw(() => {
	const textTexture = textNode({
		string: "a",
		size: 800,
		weight: 500,
		color: "#00ff00"
	});
	const uvCoord = uv();
	const uTiles = uniform(100);
	const pixelatedUVs = vec2(
		floor(uvCoord.x.mul(uTiles)).div(uTiles),
		floor(uvCoord.y.mul(uTiles)).div(uTiles)
	);
	return texture(textTexture, pixelatedUVs);
});

document.body.appendChild(canvas.canvasElement);
