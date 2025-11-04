import "$demo/style.css";

import { Canvas2D } from "$lib";
import { mx_fractal_noise_vec2, uniform, uv, vec3 } from "three/tsl";

const canvas = new Canvas2D(document.querySelector("#app")!, 800, 800, true);

canvas.draw((time) => {
	const UV = uv();

	const stripeNumber = uniform(8);
	const noiseScale = uniform(0.5);
	const displaceStrength = uniform(0.1); // Strength of the displacement

	// range is -0.5 to 0.5
	const noise = mx_fractal_noise_vec2(
		vec3(UV.x.mul(noiseScale), UV.y.mul(noiseScale), time * 0.2)
	);

	const displacedUV = UV.add(noise.mul(displaceStrength));

	const displacedStripes = displacedUV.x.mul(stripeNumber).fract();

	return vec3(displacedStripes);
});
