import "./style.css";
import { BaseMaterial } from "./materials";
import { Scene2D } from "$lib";

const initWidth = 800;
const initHeight = 800;

const materialInfo = BaseMaterial(initWidth, initHeight);

const { canvas, onDrawScene } = Scene2D(
	document.querySelector("#app")!,
	initWidth,
	initHeight,
	materialInfo,
	true
);

canvas.addEventListener("mousemove", (event) => {
	const rect = canvas.getBoundingClientRect();
	mouseX = event.clientX - rect.left;
});

let mouseX = 0;

onDrawScene(() => materialInfo.draw(mouseX));
