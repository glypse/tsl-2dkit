import "$demo/style.css";

import { Canvas2D, colorLookup, getAspectCorrectedUV, oklchToRgb } from "$lib";
/* import { lumaBlur } from "$lib/blur/lumaBlur"; */
import {
	float,
	Fn,
	/* int, */
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
	stats: false,
	antialias: "smaa"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const seed = uniform(Math.random() * 10000);

await canvas.draw(() => {
	const paletteNoiseScale = uniform(1);

	const gradientFn = Fn(({ t }: { t: Node }) => {
		const noiseChroma = mx_noise_float(
			vec3(t.mul(paletteNoiseScale), float(0.5), time.mul(0).add(seed))
		);

		const noiseHue = mx_noise_float(
			vec3(
				t.mul(paletteNoiseScale.mul(1)),
				float(0.5),
				time.mul(0).add(seed).add(100)
			)
		);

		return oklchToRgb(
			remap(t, 0, 1, 0.9, 0.2),
			remap(noiseChroma, -1.5, 1.5, 0, 0.35),
			remap(noiseHue, 0, 1, 0, 360 * 2)
		);
	});

	const canvasSize = vec2(canvas.widthUniform, canvas.heightUniform);

	const UV = getAspectCorrectedUV(uv(), canvasSize, "cover");

	const stripeNumber = uniform(14);
	const displaceScale = uniform(0.75);
	const displaceStrength = uniform(1.0);
	const displaceSpeed = uniform(0.1);
	const noiseOverlayStepsRange = uniform(1);
	const noiseOverlayScale = uniform(1);
	const noiseOverlaySpeed = uniform(0.3);
	const noiseOverlayStrength = uniform(1);
	const baseNoiseStrength = uniform(0.15);

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
			UV.x.add(noiseOverlaySteps).mul(noiseOverlayScale),
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

	/* const blurNoiseScale = uniform(1.5);
	const blurNoiseSpeed = uniform(0.5);
	const blurNoise = mx_noise_float(
		vec3(
			UV.x.mul(blurNoiseScale),
			UV.y.mul(blurNoiseScale),
			time.mul(blurNoiseSpeed)
		).add(seed)
	).remap(-0.2, 0.7, 0, 1);

	const blurred = lumaBlur(overlayedStripes, blurNoise.r, {
		maxIterations: int(16)
	}); */

	return colorLookup(overlayedStripes.r, gradientFn);
});

document.body.appendChild(canvas.canvasElement);

let pressTimer: number;
let isLongPress = false;

canvas.canvasElement.addEventListener("pointerdown", (event) => {
	event.preventDefault();
	isLongPress = false;
	pressTimer = setTimeout(() => {
		isLongPress = true;
		if (document.fullscreenElement) {
			void document.exitFullscreen();
		} else {
			void document.documentElement.requestFullscreen();
		}
	}, 500);
});

canvas.canvasElement.addEventListener("pointerup", () => {
	clearTimeout(pressTimer);
	if (!isLongPress) {
		seed.value = Math.random() * 10000;
	}
});

/* await canvas.renderer.debug
	.getShaderAsync(canvas.scene, canvas.camera, canvas.mesh)
	.then((shaderInfo) => {
		
		console.log(shaderInfo.fragmentShader);
	});
 */
