import { MeshBasicNodeMaterial } from "three/webgpu";
import { Fn, uv, texture } from "three/tsl";
import { initCanvas, handleCanvasResize } from "$lib";

export const BaseMaterial = (width: number, height: number) => {
	let { canvas, ctx, canvasTexture } = initCanvas({
		width,
		height
	});

	function draw() {
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Hue shift to visualise when the canvas is drawing vs when not
		const time = performance.now() * 500;
		const hue = (time / 1000) % 360;
		ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
		ctx.font = `500 ${Math.max(canvas.width, canvas.height)}px "Times"`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		ctx.fillText("a", canvas.width / 2, canvas.height / 2);

		canvasTexture.needsUpdate = true;
	}

	const outputNode = Fn(() => {
		return texture(canvasTexture, uv());
	});

	const material = new MeshBasicNodeMaterial({
		colorNode: outputNode()
	});

	function resize(newWidth: number, newHeight: number) {
		({ canvas, ctx, canvasTexture } = handleCanvasResize(
			newWidth,
			newHeight,
			canvasTexture,
			material,
			outputNode
		));
	}

	return { material, draw, resize };
};
