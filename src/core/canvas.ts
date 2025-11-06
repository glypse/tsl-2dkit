import { type ShaderNodeFn } from "three/src/nodes/TSL.js";
import { CanvasTexture, NodeMaterial } from "three/webgpu";

export function initCanvas(width: number, height: number) {
	const dpr = window.devicePixelRatio;
	const canvas = document.createElement("canvas");
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	const ctx = canvas.getContext("2d")!;
	const canvasTexture = new CanvasTexture(canvas);

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
	material: NodeMaterial,
	outputNode: ShaderNodeFn<[]>
) {
	canvasTexture.dispose();
	const {
		canvas,
		ctx,
		canvasTexture: newCanvasTexture
	} = initCanvas(newWidth, newHeight);
	canvasTexture = newCanvasTexture;
	material.colorNode = outputNode();
	material.needsUpdate = true;

	return { canvas, ctx, canvasTexture };
}
