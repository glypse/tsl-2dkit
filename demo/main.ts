import "./style.css";
import { getBaseMaterial } from "./materials";
import { Scene2D } from "$lib";

const initWidth = 800;
const initHeight = 800;

const baseMaterial = getBaseMaterial(initWidth, initHeight);

const { canvas, onDrawScene } = Scene2D(
	document.querySelector("#app")!,
	initWidth,
	initHeight,
	baseMaterial,
	true
);

canvas.addEventListener("mousemove", (event) => {
	const rect = canvas.getBoundingClientRect();
	mouseX = event.clientX - rect.left;
});

let mouseX = 0;

onDrawScene(() => baseMaterial.draw(mouseX));
