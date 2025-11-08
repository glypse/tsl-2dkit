import "$demo/style.css";

import { Canvas2D, colorLookup, oklchToRgb } from "$lib";
import { seededRandom } from "three/src/math/MathUtils.js";
import {
	float,
	Fn,
	mx_noise_float,
	mx_noise_vec3,
	remap,
	time,
	uniform,
	uv,
	vec3
} from "three/tsl";
import { Node } from "three/webgpu";

const canvas = new Canvas2D(800, 800, { stats: true, antialias: "smaa" });

await canvas.draw(() => {
	const paletteNoiseScale = uniform(1);
	const paletteSpeed = 0.5;

	const gradientFn = Fn(({ t }: { t: Node }) => {
		const noise = mx_noise_vec3(
			vec3(
				t.mul(paletteNoiseScale),
				float(0.5).mul(paletteNoiseScale),
				time
					.mul(paletteSpeed)
					.add(uniform(seededRandom(121053870)).mul(100000))
			)
		);

		return oklchToRgb(
			remap(t, 0, 1, 0.1, 1),
			remap(noise.y, -1, 1, 0, 0.37),
			remap(noise.z, -1, 1, 0, 360)
		);
	});

	const UV = uv();

	const stripeNumber = uniform(6);
	const noiseScale = uniform(1.2);
	const displaceStrength = uniform(0.4);
	const speed = uniform(0.0);

	// range is -0.5 to 0.5
	const noise = mx_noise_float(
		vec3(UV.x.mul(noiseScale), UV.y.mul(noiseScale), time.mul(speed))
	);

	const displacedUV = UV.add(noise.mul(displaceStrength));

	const displacedStripes = displacedUV.x.mul(stripeNumber).fract();

	return colorLookup(displacedStripes, gradientFn);
});

document.body.appendChild(canvas.canvasElement);
