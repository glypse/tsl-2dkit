import "$demo/style.css";

import { Canvas2D, colorLookup, getAspectCorrectedUV, oklchToRgb } from "$lib";
import {
	float,
	Fn,
	mx_noise_float,
	remap,
	time,
	uniform,
	uv,
	vec2,
	vec3
} from "three/tsl";
import { Node } from "three/webgpu";

const canvas = new Canvas2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const seed = uniform(Math.random() * 10000);

await canvas.draw(() => {
	const paletteNoiseScale = uniform(1);
	const paletteSpeed = 0.1;

	const gradientFn = Fn(({ t }: { t: Node }) => {
		const noiseChroma = mx_noise_float(
			vec3(
				t.mul(paletteNoiseScale),
				float(0.5),
				time.mul(paletteSpeed).add(seed)
			)
		);

		const noiseHue = mx_noise_float(
			vec3(
				t.mul(paletteNoiseScale.mul(2)),
				float(0.5),
				time.mul(paletteSpeed).add(seed).add(100)
			)
		);

		return oklchToRgb(
			remap(t, 0, 1, 0.1, 1),
			remap(noiseChroma, -1.5, 1.5, 0, 0.35),
			remap(noiseHue, -1, 1, 0, 360)
		);
	});

	const canvasSize = vec2(canvas.widthUniform, canvas.heightUniform);

	const UV = getAspectCorrectedUV(uv(), canvasSize, "cover");

	const stripeNumber = uniform(14);
	const displaceScale = uniform(0.75);
	const displaceStrength = uniform(1.0);
	const displaceSpeed = uniform(0.1);
	const noiseOverlayStepsRange = uniform(3);
	const noiseOverlayScale = uniform(1);
	const noiseOverlaySpeed = uniform(0.5);
	const noiseOverlayStrength = uniform(1);
	const baseNoiseStrength = uniform(0.35);

	// range is -1 to 1
	const noise = mx_noise_float(
		vec3(
			UV.x.mul(displaceScale),
			UV.y.mul(displaceScale),
			time.mul(displaceSpeed).add(seed)
		)
	);

	const displacedUV = UV.add(noise.mul(displaceStrength));

	const displacedStripes = displacedUV.x.mul(stripeNumber).fract();

	const noiseOverlaySteps = displacedUV.x
		.mul(stripeNumber)
		.floor()
		.div(stripeNumber)
		.mul(noiseOverlayStepsRange)
		.add(
			displacedUV.x
				.mul(stripeNumber)
				.fract()
				.mul(noiseOverlayScale)
				.mul(0)
		);

	const noiseOverlay = mx_noise_float(
		vec3(
			UV.y.mul(noiseOverlayScale),
			UV.y.add(noiseOverlaySteps),
			time.mul(noiseOverlaySpeed)
		)
	);

	const overlayedStripes = displacedStripes
		.remap(0, 1, baseNoiseStrength.mul(-1), baseNoiseStrength)
		.add(
			noiseOverlay.remap(
				-1,
				1,
				noiseOverlayStrength.mul(-1),
				noiseOverlayStrength
			)
		)
		.remap(-1, 1, 0, 1);

	/* return overlayedStripes; */

	return colorLookup(overlayedStripes, gradientFn);
});

document.body.appendChild(canvas.canvasElement);
