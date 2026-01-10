import { color } from "three/tsl";
import { TSLScene2D } from "$lib"; // Replace "$lib" with "tsl-2dkit"

const scene = new TSLScene2D(window.innerWidth, window.innerHeight);

window.addEventListener("resize", () => {
	scene.setSize(window.innerWidth, window.innerHeight);
});

await scene.build(() => {
	const final = color("#ff8c00");
	return final;
});

document.body.appendChild(scene.canvasElement);
