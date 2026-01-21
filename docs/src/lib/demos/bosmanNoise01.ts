import { float, Fn, mx_noise_float, remap, uniform, vec3 } from "three/tsl";
import { type Node } from "three/webgpu";
import {
	boxBlur,
	TSLScene2D,
	CanvasRecorder,
	colorLookup,
	FixedTime,
	aspectCorrectedUV,
	oklchToRgb,
	UniformSlider
} from "tsl-2dkit";

/**
 * Bosman Noise demo
 *
 * Recreation of an artwork of Jerry Lee Bosman
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	// Create controls div
	const controls = document.createElement("div");
	controls.id = "controls";
	container?.appendChild(controls);

	// Create buttons
	const fullscreenButton = document.createElement("button");
	fullscreenButton.id = "fullscreen-button";
	fullscreenButton.textContent = "Fullscreen";
	controls.appendChild(fullscreenButton);

	const recordButton = document.createElement("button");
	recordButton.id = "record-button";
	recordButton.textContent = "🔴 Record";
	controls.appendChild(recordButton);

	const recordFixedButton = document.createElement("button");
	recordFixedButton.id = "record-fixed-button";
	recordFixedButton.textContent = "🎬 Record 5s @ 60fps";
	controls.appendChild(recordFixedButton);

	// Create FixedTime for controllable time (needed for fixed-framerate recording)
	const fixedTime = new FixedTime();

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		stats: true,
		antialias: "none",
		renderMode: "continuous" // Uses time-based animation
	});

	// Connect fixedTime to canvas for automatic updates
	scene.setFixedTime(fixedTime);

	// Use fixedTime.timeUniform instead of `time` from three/tsl
	const time = fixedTime.timeUniform;

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener("resize", resizeHandler);

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

	const controlsToDispose = new Set<UniformSlider>();

	const seedSlider = new UniformSlider(controls, "Seed:", seed, {
		min: 0,
		max: 100
	});
	controlsToDispose.add(seedSlider);
	/* new UniformSlider(controls, "Lightness variance:", lightnessVariance, {
	min: 0.1,
	max: 5,
	step: 0.1
}); */
	const darkSlider = new UniformSlider(controls, "Dark:", dark, {
		min: 0,
		max: 1
	});
	controlsToDispose.add(darkSlider);
	const lightSlider = new UniformSlider(controls, "Light:", light, {
		min: 0,
		max: 1
	});
	controlsToDispose.add(lightSlider);
	const chromaVarianceSlider = new UniformSlider(
		controls,
		"Chroma variance:",
		chromaVariance,
		{
			min: 0.1,
			max: 5
		}
	);
	controlsToDispose.add(chromaVarianceSlider);
	const chromaMaxSlider = new UniformSlider(
		controls,
		"Chroma max:",
		chromaMax,
		{
			min: 0,
			max: 1
		}
	);
	controlsToDispose.add(chromaMaxSlider);
	const hueVarianceSlider = new UniformSlider(
		controls,
		"Hue variance:",
		hueVariance,
		{
			min: 0.1,
			max: 5
		}
	);
	controlsToDispose.add(hueVarianceSlider);
	const hueSpeedSlider = new UniformSlider(controls, "Hue speed:", hueSpeed, {
		min: 0,
		max: 1
	});
	controlsToDispose.add(hueSpeedSlider);
	const stripeNumberSlider = new UniformSlider(
		controls,
		"Stripe Number:",
		stripeNumber,
		{
			min: 1,
			max: 50
		}
	);
	controlsToDispose.add(stripeNumberSlider);
	const displaceScaleSlider = new UniformSlider(
		controls,
		"Displace Scale:",
		displaceScale,
		{
			min: 0.1,
			max: 5
		}
	);
	controlsToDispose.add(displaceScaleSlider);
	const displaceStrengthSlider = new UniformSlider(
		controls,
		"Displace Strength:",
		displaceStrength,
		{
			min: 0,
			max: 5
		}
	);
	controlsToDispose.add(displaceStrengthSlider);
	const displaceSpeedSlider = new UniformSlider(
		controls,
		"Displace Speed:",
		displaceSpeed,
		{
			min: 0,
			max: 2
		}
	);
	controlsToDispose.add(displaceSpeedSlider);
	const noiseOverlayStepsRangeSlider = new UniformSlider(
		controls,
		"Noise Overlay Steps Range:",
		noiseOverlayStepsRange,
		{
			min: 0,
			max: 10
		}
	);
	controlsToDispose.add(noiseOverlayStepsRangeSlider);
	const noiseOverlayScaleSlider = new UniformSlider(
		controls,
		"Noise Overlay Scale:",
		noiseOverlayScale,
		{
			min: 0.1,
			max: 10
		}
	);
	controlsToDispose.add(noiseOverlayScaleSlider);
	const noiseOverlaySpeedSlider = new UniformSlider(
		controls,
		"Noise Overlay Speed:",
		noiseOverlaySpeed,
		{
			min: 0,
			max: 2
		}
	);
	controlsToDispose.add(noiseOverlaySpeedSlider);
	const noiseOverlayStrengthSlider = new UniformSlider(
		controls,
		"Noise Overlay Strength:",
		noiseOverlayStrength,
		{
			min: 0,
			max: 3
		}
	);
	controlsToDispose.add(noiseOverlayStrengthSlider);
	const baseNoiseStrengthSlider = new UniformSlider(
		controls,
		"Base Noise Strength:",
		baseNoiseStrength,
		{
			min: 0,
			max: 0.5
		}
	);
	controlsToDispose.add(baseNoiseStrengthSlider);
	const maxBlurSlider = new UniformSlider(controls, "Max Blur:", maxBlur, {
		min: 0,
		max: 100
	});
	controlsToDispose.add(maxBlurSlider);

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

	container?.appendChild(scene.canvasElement);

	function fullscreenHandler(): void {
		if (document.fullscreenElement) {
			void document.exitFullscreen();
		} else {
			void document.documentElement.requestFullscreen();
		}
	}
	fullscreenButton.addEventListener("click", fullscreenHandler);

	const recorder = new CanvasRecorder(scene, fixedTime, {
		fps: 60,
		format: "webm",
		filename: "bosman-noise-recording"
	});

	function recordHandler(): void {
		if (recorder.isRecording) {
			void recorder.stop();
			recordButton.textContent = "🔴 Record";
		} else {
			void recorder.start();
			recordButton.textContent = "⏹ Stop";
		}
	}
	recordButton.addEventListener("click", recordHandler);

	function recordFixedHandler(): void {
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
	}
	recordFixedButton.addEventListener("click", recordFixedHandler);

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);
		fullscreenButton.removeEventListener("click", fullscreenHandler);
		recordButton.removeEventListener("click", recordHandler);
		recordFixedButton.removeEventListener("click", recordFixedHandler);

		container?.removeChild(controls);
		container?.removeChild(scene.canvasElement);

		// Dispose tsl-2dkit resources
		scene.dispose();
		recorder.dispose();

		// Dispose all controls
		for (const control of controlsToDispose) {
			control.dispose();
		}
	};
}
