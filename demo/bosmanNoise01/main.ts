import "$demo/style.css";

import {
	Canvas2D,
	colorLookup,
	getAspectCorrectedUV,
	oklchToRgb,
	UniformSlider
} from "$lib";
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
	antialias: "none"
});

window.addEventListener("resize", () => {
	canvas.resize(window.innerWidth, window.innerHeight);
});

const seed = uniform(Math.random() * 100);

/* const lightnessVariance = uniform(1); */
const dark = uniform(0.1);
const light = uniform(1.0);
const chromaVariance = uniform(1);
const hueVariance = uniform(1);
const hueSpeed = uniform(0);
const stripeNumber = uniform(14);
const displaceScale = uniform(0.75);
const displaceStrength = uniform(1.0);
const displaceSpeed = uniform(0.1);
const noiseOverlayStepsRange = uniform(1);
const noiseOverlayScale = uniform(1);
const noiseOverlaySpeed = uniform(0.3);
const noiseOverlayStrength = uniform(1);
const baseNoiseStrength = uniform(0.1);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const controls = document.getElementById("controls")!;

new UniformSlider(controls, "Seed:", seed, { min: 0, max: 100 });
/* new UniformSlider(controls, "Lightness variance:", lightnessVariance, {
	min: 0.1,
	max: 5,
	step: 0.1
}); */
new UniformSlider(controls, "Dark:", dark, {
	min: 0,
	max: 1
});
new UniformSlider(controls, "Light:", light, {
	min: 0,
	max: 1
});
new UniformSlider(controls, "Chroma variance:", chromaVariance, {
	min: 0.1,
	max: 5
});
new UniformSlider(controls, "Hue variance:", hueVariance, {
	min: 0.1,
	max: 5
});
new UniformSlider(controls, "Hue speed:", hueSpeed, {
	min: 0,
	max: 3
});
new UniformSlider(controls, "Stripe Number:", stripeNumber, {
	min: 1,
	max: 50
});
new UniformSlider(controls, "Displace Scale:", displaceScale, {
	min: 0.1,
	max: 5
});
new UniformSlider(controls, "Displace Strength:", displaceStrength, {
	min: 0,
	max: 5
});
new UniformSlider(controls, "Displace Speed:", displaceSpeed, {
	min: 0,
	max: 2
});
new UniformSlider(
	controls,
	"Noise Overlay Steps Range:",
	noiseOverlayStepsRange,
	{ min: 0, max: 10 }
);
new UniformSlider(controls, "Noise Overlay Scale:", noiseOverlayScale, {
	min: 0.1,
	max: 10
});
new UniformSlider(controls, "Noise Overlay Speed:", noiseOverlaySpeed, {
	min: 0,
	max: 2
});
new UniformSlider(controls, "Noise Overlay Strength:", noiseOverlayStrength, {
	min: 0,
	max: 3
});
new UniformSlider(controls, "Base Noise Strength:", baseNoiseStrength, {
	min: 0,
	max: 0.5
});

await canvas.draw(() => {
	const gradientFn = Fn(({ t }: { t: Node }) => {
		/* const noiseLightness = mx_noise_float(
			vec3(
				t.mul(lightnessVariance),
				float(0.5),
				time.mul(0).add(seed).add(200)
			)
		); */

		const noiseChroma = mx_noise_float(
			vec3(t.mul(chromaVariance), float(0.5), time.mul(0).add(seed))
		);

		const noiseHue = mx_noise_float(
			vec3(
				t.mul(hueVariance.mul(1)),
				float(0.5),
				time.mul(hueSpeed).add(seed).add(100)
			)
		);

		return oklchToRgb(
			remap(t, 0, 1, light, dark),
			remap(noiseChroma, -1.5, 1.5, 0, 0.35),
			remap(noiseHue, 0, 1, 0, 360 * 2)
		);
	});

	const canvasSize = vec2(canvas.widthUniform, canvas.heightUniform);

	const UV = getAspectCorrectedUV(uv(), canvasSize, "cover");

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

const fullscreenButton = document.getElementById(
	"fullscreen-button"
) as HTMLButtonElement;

fullscreenButton.addEventListener("click", () => {
	if (document.fullscreenElement) {
		void document.exitFullscreen();
	} else {
		void document.documentElement.requestFullscreen();
	}
});

/* await canvas.renderer.debug
	.getShaderAsync(canvas.scene, canvas.camera, canvas.mesh)
	.then((shaderInfo) => {
		
		console.log(shaderInfo.fragmentShader);
	});
 */
