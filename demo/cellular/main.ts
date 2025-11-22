import "$demo/style.css";

import {
	Canvas2D,
	getAspectCorrectedUV,
	setBackgroundColor,
	textNode,
	voronoi
} from "$lib";
import { uv, texture, vec2, vec3, float, time } from "three/tsl";
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

	const voronoiScale = float(4);
	const voronoiSpeed = float(0);
	const voronoiPos = vec3(
		UV.x.mul(voronoiScale),
		UV.y.mul(voronoiScale),
		time.mul(voronoiSpeed)
	);
	const voronoiCutoff = float(10);

	const screenSpaceSmoothness = float(1)
		.div(window.devicePixelRatio)
		.div(0.2);

	const myVoronoi = voronoi(voronoiPos, {
		featureOutput: "screenSpaceEdge"
	}).smoothstep(
		voronoiCutoff.sub(screenSpaceSmoothness),
		voronoiCutoff.add(screenSpaceSmoothness)
	);

	return myVoronoi;
});

document.body.appendChild(canvas.canvasElement);
