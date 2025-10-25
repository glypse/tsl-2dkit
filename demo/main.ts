import "./style.css";
import { BaseMaterial } from "./materials";
import { init2DScene } from "$lib";

let width = 800;
let height = 800;

const materialInfo = BaseMaterial(width, height);

const { canvas, onDrawScene } = init2DScene(
	document.querySelector("#app")!,
	width,
	height,
	materialInfo,
	true
);

canvas.addEventListener("mousemove", (event) => {
	const rect = canvas.getBoundingClientRect();
	mouseX = event.clientX - rect.left;
});

let mouseX = 0;

onDrawScene(() => materialInfo.draw(mouseX));
