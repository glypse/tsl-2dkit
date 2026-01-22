import { color, mix, uniform } from "three/tsl";
import {
	aspectCorrectedUV,
	colorLookup,
	FixedTime,
	gaussianBlur,
	gradient,
	MediaTexture,
	TSLScene2D
} from "tsl-2dkit";

/**
 * Demo using an image and applying blur and gradient mapping to it
 *
 * @returns A cleanup function to dispose of all resources
 */
export default async function (): Promise<() => void> {
	const container = document.getElementById("demo-container");

	const scene = new TSLScene2D(window.innerWidth, window.innerHeight, {
		renderMode: "continuous",
		stats: true
	});

	const fixedTime = new FixedTime();
	scene.setFixedTime(fixedTime);
	const time = fixedTime.timeUniform;

	function resizeHandler(): void {
		scene.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener("resize", resizeHandler);

	const image = new MediaTexture({
		src: "/person_icon.svg"
	});

	await scene.build(() => {
		const UV = aspectCorrectedUV(
			"contain",
			scene.aspectUniform,
			"generation"
		);
		const sampledImage = image.sample(UV.sub(0.5).mul(1.5));

		const imageOnBg = mix(0, 1, sampledImage.a);

		const ringsAmout = uniform(10);
		const ringsSpeed = uniform(4);
		const blurMap = UV.sub(0.5)
			.distance(0)
			.mul(ringsAmout)
			.sub(time.mul(ringsSpeed))
			.sin()
			.remap(-1, 1, 0, 1);

		const blurStrength = uniform(100);

		const blurredImage = gaussianBlur(imageOnBg, blurMap.mul(blurStrength));

		const gradientMap = gradient(
			[
				{ position: 0, color: color("#000000") },
				/* { position: 0.5, color:  color("#FF0000") }, */
				{ position: 1, color: color("#0000FF") }
			],
			"oklch"
		);

		const coloredImage = colorLookup(blurredImage, gradientMap);

		return coloredImage;
	});

	container?.appendChild(scene.canvasElement);

	return () => {
		// Remove event listeners
		window.removeEventListener("resize", resizeHandler);

		// Remove DOM elements
		container?.removeChild(scene.canvasElement);

		// Dispose TSL-2D Kit resources
		scene.dispose();
	};
}
