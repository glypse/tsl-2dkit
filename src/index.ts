import { type ShaderNodeFn } from "three/src/nodes/TSL.js";
import { CanvasTexture, MeshBasicNodeMaterial } from "three/webgpu";

export function initCanvas(size: { width: number; height: number }) {
	const dpr = window.devicePixelRatio;
	let canvas = document.createElement("canvas");
	canvas.width = size.width * dpr;
	canvas.height = size.height * dpr;
	let ctx = canvas.getContext("2d", { colorSpace: "srgb" })!;
	let canvasTexture = new CanvasTexture(canvas);

	return {
		canvas,
		ctx,
		canvasTexture,
		dpr
	};
}

export function handleCanvasResize(
	newWidth: number,
	newHeight: number,
	canvasTexture: CanvasTexture,
	material: MeshBasicNodeMaterial,
	outputNode: ShaderNodeFn<[]>
) {
	canvasTexture.dispose();
	let {
		canvas,
		ctx,
		canvasTexture: newCanvasTexture
	} = initCanvas({
		width: newWidth,
		height: newHeight
	});
	canvasTexture = newCanvasTexture;
	material.colorNode = outputNode();
	material.needsUpdate = true;

	return { canvas, ctx, canvasTexture };
}
