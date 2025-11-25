import { CanvasTexture, NoColorSpace } from "three/webgpu";

export function initCanvas(width: number, height: number) {
	const dpr = window.devicePixelRatio;
	const canvas = document.createElement("canvas");
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d context not supported");
	ctx.scale(dpr, dpr);
	const canvasTexture = new CanvasTexture(canvas);
	canvasTexture.colorSpace = NoColorSpace;

	return {
		canvas,
		ctx,
		canvasTexture,
		dpr
	};
}
