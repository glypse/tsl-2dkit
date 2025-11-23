import "$demo/style.css";

import { Canvas2D, getAspectCorrectedUV, textNode, voronoi } from "$lib";
import { uv, vec2, vec3, float, time, texture, color, mix } from "three/tsl";
const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const voronoiScale = float(2.75);
const voronoiSpeed = float(0.3);
const voronoiCutoff = float(0.01);
const displaceStrength = float(0.05);

await canvas.draw(() => {
	const screenSpaceSmoothness = float(window.devicePixelRatio).div(5000);

	const UV = getAspectCorrectedUV(
		uv(),
		vec2(canvas.widthUniform, canvas.heightUniform)
	);

	const voronoiPos = vec3(
		UV.x.mul(voronoiScale),
		UV.y.mul(voronoiScale),
		time.mul(voronoiSpeed)
	);

	const voronoiF1 = voronoi(voronoiPos, {});

	const voronoiF1Pos = voronoi(voronoiPos, { outputMode: "color" })
		.remap(0, 1, -1, 1)
		.mul(displaceStrength);

	const voronoiSmoothF1 = voronoi(voronoiPos, {
		featureOutput: "smoothF1",
		smoothness: float(0.02)
	});

	const roundedVoronoi = voronoiF1
		.sub(voronoiSmoothF1)
		.smoothstep(
			voronoiCutoff.sub(screenSpaceSmoothness),
			voronoiCutoff.add(screenSpaceSmoothness)
		);

	const text = textNode({
		string: "Cellular",
		color: "#d1cfbb",
		fontFamily: "Fustat",
		size: 200,
		weight: 700,
		letterSpacing: "-0.05em"
	});

	const displacedText = texture(text, uv().add(vec2(0, voronoiF1Pos.x)));

	const textUnderVoronoi = mix(
		displacedText,
		color("#727153"),
		roundedVoronoi
	);

	return textUnderVoronoi;
});

document.body.appendChild(canvas.canvasElement);
