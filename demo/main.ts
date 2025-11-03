import "./style.css";

import { Canvas2D, textNode } from "$lib";
import { Fn, uv, uniform, vec2, floor, vec4, texture } from "three/tsl";

const canvas = new Canvas2D(document.querySelector("#app")!, 800, 800);

canvas.draw(() => {
	const textTexture = textNode({
		string: "a",
		size: 800,
		weight: 500,
		color: "#00ff00"
	});
	const pixelatedUVs = Fn(() => {
		const uvCoord = uv();
		const uTiles = uniform(100);
		return vec2(
			floor(uvCoord.x.mul(uTiles)).div(uTiles),
			floor(uvCoord.y.mul(uTiles)).div(uTiles)
		);
	});
	return { text: vec4(texture(textTexture, pixelatedUVs()), 1.0) };
});
