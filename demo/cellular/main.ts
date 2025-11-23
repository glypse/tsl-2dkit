import "$demo/style.css";

import { Canvas2D, getAspectCorrectedUV, gaussianBlur, voronoi } from "$lib";
import { uv, vec2, vec3, float, time } from "three/tsl";
const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const voronoiScale = float(2);
const voronoiSpeed = float(0.2);
const voronoiCutoff = float(0.005);
const screenSpaceSmoothness = float(window.devicePixelRatio).div(400);
const radius = float(75);

const UV = getAspectCorrectedUV(
	uv(),
	vec2(canvas.widthUniform, canvas.heightUniform)
);
const voronoiPos = vec3(
	UV.x.mul(voronoiScale),
	UV.y.mul(voronoiScale),
	time.mul(voronoiSpeed)
);
const myVoronoi = voronoi(voronoiPos, {
	featureOutput: "edgeProjected"
}).lessThan(voronoiCutoff);

const blurCutoff = float(0.2);
const blurredVoronoi = gaussianBlur(myVoronoi, radius).x.smoothstep(
	blurCutoff.sub(screenSpaceSmoothness),
	blurCutoff.add(screenSpaceSmoothness)
);

await canvas.draw(() => blurredVoronoi);

document.body.appendChild(canvas.canvasElement);
