import {
	color,
	cos,
	distance,
	mix,
	mx_noise_float,
	pow,
	sin,
	uniform,
	uv,
	vec2
} from "three/tsl";
import {
	aspectCorrectedUV,
	CanvasRecorder,
	colorLookup,
	FixedTime,
	gaussianBlur,
	gradient,
	oklchToRgb,
	TextTexture,
	TSLScene2D
} from "tsl-2dkit";

/**
 * A recreation of a piece by `@antonin.work` on Instagram
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const dpr = window.devicePixelRatio;

	const scene = new TSLScene2D(1080 / dpr, 1920 / dpr);

	const fixedTime = new FixedTime();
	scene.setFixedTime(fixedTime);
	const time = fixedTime.timeUniform;

	const recorder = new CanvasRecorder(scene, fixedTime, {
		fps: 60,
		format: "webm",
		filename: "blurry9-recording"
	});

	const t = (Math.sin(fixedTime.time * 1) + 1) / 2;

	const textTexture = new TextTexture({
		text: "g",
		size: 600,
		weight: lerp(200, 800, t),
		fontFamily: "Fustat",
		padding: 0
	});

	await scene.build(() => {
		const UV = uv();
		const textSample = textTexture.sample(
			UV.sub(vec2(0.5)).add(vec2(UV.y.sub(0.5).mul(-0.2), 0))
		);

		const imageOnBg = mix(0, 1, textSample.a);

		const correctedUV = aspectCorrectedUV(
			"cover",
			scene.aspectUniform,
			"generation"
		);

		const distanceFromCenter = uniform(0.3);
		const pointFive = uniform(0.5);
		const rawBlurMap = distance(
			correctedUV,
			vec2(
				pointFive.add(sin(time).mul(distanceFromCenter)),
				pointFive.add(cos(time).mul(distanceFromCenter))
			)
		).mul(2);

		const easedBlurMap = pow(rawBlurMap, 5).clamp(0, 1);

		const blurStrength = uniform(400);

		const blurredText = gaussianBlur(
			imageOnBg,
			easedBlurMap.mul(blurStrength)
		);

		const gradientMap = gradient(
			[
				{
					position: 0,
					color: color("#000EFF")
				},
				{
					position: 0.3,
					color: oklchToRgb(
						uniform(0.5885),
						uniform(0.3),
						uniform(230)
					)
				},
				{
					position: 1,
					color: color("#FFFFFF")
				}
			],
			"oklch"
		);

		const dither = mx_noise_float(correctedUV.mul(2000));

		const lightOverlayedText = blurredText.add(
			rawBlurMap.y.pow(2).mul(0.25)
		);

		const coloredImage = colorLookup(
			lightOverlayedText.add(dither.mul(0.02)),
			gradientMap
		);

		return coloredImage;
	});

	let animationId: number | null = null;
	let isRecording = false;

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	function animate(): void {
		// Oscillate font weight between 200 and 800
		const t = (Math.sin(fixedTime.time * 1) + 1) / 2;
		textTexture.parameters.weight = lerp(200, 800, t);
		textTexture.needsUpdate = true;

		if (!isRecording) {
			scene.requestRender();
		}
		animationId = requestAnimationFrame(animate);
	}

	animate();

	container?.appendChild(scene.canvasElement);

	async function clickHandler(): Promise<void> {
		isRecording = true;

		await recorder.start({ duration: 15, filename: "blurry9-15s" });

		isRecording = false;
	}

	function handleClick(): void {
		void clickHandler();
	}

	scene.canvasElement.addEventListener("click", handleClick);

	return () => {
		// Stop animation loop
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
		}

		// Remove event listeners
		scene.canvasElement.removeEventListener("click", handleClick);

		// Remove DOM elements
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		textTexture.dispose();
		scene.dispose();
		recorder.dispose();
	};
}
