import "$demo/style.css";

import { Canvas2D } from "$lib";
import { mx_noise_float, uniform, uv, vec3 } from "three/tsl";

const canvas = new Canvas2D(document.querySelector("#app")!, 800, 800, true);

canvas.draw((time) => {
	const UV = uv();

	const stripeNumber = uniform(6);
	const noiseScale = uniform(1.2);
	const displaceStrength = uniform(0.2);
	const speed = uniform(0.4);

	// range is -0.5 to 0.5
	const noise = mx_noise_float(
		vec3(UV.x.mul(noiseScale), UV.y.mul(noiseScale), time.mul(speed))
	);

	const displacedUV = UV.add(noise.mul(displaceStrength));

	const displacedStripes = displacedUV.x.mul(stripeNumber).fract();

	return displacedStripes;
});
