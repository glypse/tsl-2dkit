import "./style.css";
import {
	handleCanvasResize,
	initCanvas,
	Scene2D,
	type TSLMaterial
} from "$lib";
import { Fn, texture, uv } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

const initWidth = 800;
const initHeight = 800;

let {
	canvas: materialCanvas,
	ctx,
	canvasTexture
} = initCanvas(initWidth, initHeight);

function drawCtx(mouseX: number) {
	ctx.fillStyle = "#0000ff";
	ctx.fillRect(0, 0, materialCanvas.width, materialCanvas.height);

	const hue = (mouseX * 0.5) % 360;
	ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
	ctx.font = `500 ${Math.max(materialCanvas.width, materialCanvas.height)}px "Times"`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	ctx.fillText("a", materialCanvas.width / 2, materialCanvas.height / 2);

	canvasTexture.needsUpdate = true;
}

const outputNode = Fn(() => {
	return texture(canvasTexture, uv());
});

const material = new MeshBasicNodeMaterial({
	colorNode: outputNode()
});

function resizeMaterial(newWidth: number, newHeight: number) {
	({
		canvas: materialCanvas,
		ctx,
		canvasTexture
	} = handleCanvasResize(
		newWidth,
		newHeight,
		canvasTexture,
		material,
		outputNode
	));
}

const baseMaterial = {
	material,
	draw: drawCtx,
	resize: resizeMaterial
} satisfies TSLMaterial;

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
