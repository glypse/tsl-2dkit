import "$demo/style.css";

import {
	Canvas2D,
	getAspectCorrectedUV,
	setBackgroundColor,
	textNode,
	voronoi
} from "$lib";
import { uv, texture, vec2, vec3, float } from "three/tsl";
const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

await canvas.draw(() => {
	setBackgroundColor("#ff2800");

	const UV = getAspectCorrectedUV(
		uv(),
		vec2(canvas.widthUniform, canvas.heightUniform)
	);

	const cellularText = textNode({
		string: "Cellular",
		fontFamily: "Fustat",
		color: "#d1cfbb",
		size: 200,
		weight: 700,
		letterSpacing: "-0.05em"
	});

	const myVoronoi = voronoi(vec3(UV.x, UV.y, 1).mul(10), {
		exponent: float(2),
		featureOutput: "f2"
	});

	return myVoronoi;
});

document.body.appendChild(canvas.canvasElement);
