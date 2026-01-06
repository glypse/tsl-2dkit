import "$demo/style.css";

import {
	boxBlur,
	TSLScene2D,
	CanvasRecorder,
	colorLookup,
	FixedTime,
	aspectCorrectedUV,
	oklchToRgb,
	UniformSlider
} from "$lib";
import { float, Fn, mx_noise_float, remap, uniform, vec3 } from "three/tsl";
import { Node } from "three/webgpu";

// Create FixedTime for controllable time (needed for fixed-framerate recording)
const fixedTime = new FixedTime();

const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
	stats: true,
	antialias: "none"
});

// Connect fixedTime to canvas for automatic updates
scene.setFixedTime(fixedTime);

// Use fixedTime.timeUniform instead of `time` from three/tsl
const time = fixedTime.timeUniform;

window.addEventListener("resize", () => {
	scene.resize(window.innerWidth, window.innerHeight);
});

const seed = uniform(Math.random() * 100);

/* const lightnessVariance = uniform(1); */
const dark = uniform(0.1);
const light = uniform(1.0);
const chromaVariance = uniform(1);
const chromaMax = uniform(0.3);
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
const maxBlur = uniform(60);

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
new UniformSlider(controls, "Chroma max:", chromaMax, {
	min: 0,
	max: 1
});
new UniformSlider(controls, "Hue variance:", hueVariance, {
	min: 0.1,
	max: 5
});
new UniformSlider(controls, "Hue speed:", hueSpeed, {
	min: 0,
	max: 1
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
new UniformSlider(controls, "Max Blur:", maxBlur, {
	min: 0,
	max: 100
});

await scene.build(() => {
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
			remap(noiseChroma, -1.5, 1.5, 0, chromaMax),
			remap(noiseHue, 0, 1, 0, 360)
		);
	});

	const UV = aspectCorrectedUV();

	// range is -1 to 1
	const dispNoise = mx_noise_float(
		vec3(
			UV.x.mul(displaceScale),
			UV.y.mul(displaceScale),
			time.mul(displaceSpeed).add(seed)
		)
	);

	const displacedUV = UV.add(dispNoise.mul(displaceStrength));

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

	const blurNoiseScale = uniform(1.5);
	const blurNoiseSpeed = uniform(0.5);
	const blurNoise = mx_noise_float(
		vec3(
			UV.x.mul(blurNoiseScale),
			UV.y.mul(blurNoiseScale),
			time.mul(blurNoiseSpeed)
		).add(seed)
	).remap(-0.2, 0.7, 0, 1);

	const blurred = boxBlur(overlayedStripes, blurNoise.r.mul(maxBlur));

	return colorLookup(blurred.r, gradientFn);
});

document.body.appendChild(scene.canvasElement);

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

const recorder = new CanvasRecorder(scene, fixedTime, {
	fps: 60,
	format: "webm",
	filename: "bosman-noise-recording"
});

const recordButton = document.getElementById(
	"record-button"
) as HTMLButtonElement;

recordButton.addEventListener("click", () => {
	if (recorder.isRecording) {
		void recorder.stop();
		recordButton.textContent = "🔴 Record";
	} else {
		void recorder.start();
		recordButton.textContent = "⏹ Stop";
	}
});

const recordFixedButton = document.getElementById(
	"record-fixed-button"
) as HTMLButtonElement;

recordFixedButton.addEventListener("click", () => {
	recordFixedButton.disabled = true;
	recordFixedButton.textContent = "⏳ Recording...";

	void recorder
		.start({
			duration: 5,
			filename: "bosman-noise-5s"
		})
		.then(() => {
			recordFixedButton.disabled = false;
			recordFixedButton.textContent = "🎬 Record 5s @ 60fps";
		})
		.catch((err: unknown) => {
			console.error("Recording failed:", err);
			recordFixedButton.disabled = false;
			recordFixedButton.textContent = "🎬 Record 5s @ 60fps";
		});
});
