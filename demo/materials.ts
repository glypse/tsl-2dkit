import { uv, texture } from "three/tsl";
import { TSLMaterial } from "$lib/materials";

export const BaseMaterial = (width: number, height: number) => {
	return new TSLMaterial(width, height, {
		draw(material, mouseX: number) {
			let { ctx, canvas, canvasTexture } = material;
			ctx.fillStyle = "#0000ff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Hue shift to visualise when the canvas is drawing vs when not
			const hue = (mouseX * 0.5) % 360;
			ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
			ctx.font = `500 ${Math.max(canvas.width, canvas.height)}px "Times"`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			ctx.fillText("a", canvas.width / 2, canvas.height / 2);

			canvasTexture.needsUpdate = true;
		},
		outputNode: (canvasTexture) => {
			return texture(canvasTexture, uv());
		}
	});
};
