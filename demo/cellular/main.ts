import "$demo/style.css";

import { Canvas2D, getAspectCorrectedUV, text, voronoi } from "$lib";
import { vec2, vec3, float, time, color, mix, uniform } from "three/tsl";

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

let seed = uniform(Math.random() * 10000);

window.addEventListener("click", () => {
	seed = uniform(Math.random() * 10000);
});

const voronoiScale = uniform(4);
const voronoiSpeed = uniform(0.4);
const voronoiCutoff = uniform(0.009);
const displaceStrength = uniform(0.05);

await canvas.draw(() => {
	const screenSpaceSmoothness = float(window.devicePixelRatio)
		.div(15000)
		.mul(voronoiScale);

	const UV = getAspectCorrectedUV();

	const voronoiPos = vec3(
		UV.x.mul(voronoiScale),
		UV.y.mul(voronoiScale),
		time.mul(voronoiSpeed).add(seed)
	);

	const voronoiResult = voronoi(voronoiPos, {});

	const voronoiF1 = voronoiResult.get("distance").x;

	const voronoiF1Color = voronoiResult.get("color").remap(0, 1, -1, 1);

	const voronoiSmoothResult = voronoi(voronoiPos, {
		featureOutput: "smoothF1",
		smoothness: float(0.02)
	});

	const voronoiSmoothF1 = voronoiSmoothResult.get("distance").x;

	// CROSSES

	const crossesThickness = float(0.005);
	const crossesSizeVariance = float(0.075);
	const crossesSize = float(0.2).add(
		voronoiF1Color.x.mul(crossesSizeVariance)
	);
	const voronoiF1Pos = voronoiResult.get("position");
	const voronoiCellUV = voronoiF1Pos.sub(voronoiPos).mul(1).xy;
	const crossesHorizontalLine = voronoiCellUV.x
		.abs()
		.lessThan(crossesThickness)
		.and(voronoiCellUV.y.abs().lessThan(crossesSize));
	const crossesVerticalLine = voronoiCellUV.y
		.abs()
		.lessThan(crossesThickness)
		.and(voronoiCellUV.x.abs().lessThan(crossesSize));
	const crosses = crossesHorizontalLine.or(crossesVerticalLine);

	const roundedVoronoi = voronoiF1
		.sub(voronoiSmoothF1)
		.smoothstep(
			voronoiCutoff.sub(screenSpaceSmoothness),
			voronoiCutoff.add(screenSpaceSmoothness)
		);

	const textSample = text(
		{
			string: "Cellular",
			color: "#d1cfbb",
			fontFamily: "Fustat",
			size: 150,
			weight: 700,
			letterSpacing: "-0.05em",
			lineHeight: 0.8,
			debug: false
		},
		(textUV) => {
			return textUV
				.add(vec2(0.5, 0.5))
				.add(vec2(0, voronoiF1Color.mul(displaceStrength).x));
		}
	);

	// Blend text with background color using alpha
	const backgroundColor = color("#ff2800");
	const displacedText = mix(backgroundColor, textSample.rgb, textSample.a);

	const textAndCrosses = mix(displacedText, color("#d1cfbb"), crosses);

	const voronoiTextAndCrosses = mix(
		textAndCrosses,
		color("#727153"),
		roundedVoronoi
	);

	return voronoiTextAndCrosses;
});

document.body.appendChild(canvas.canvasElement);
