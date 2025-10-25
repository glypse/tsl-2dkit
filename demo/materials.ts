import { Fn, uv, texture } from "three/tsl";
import { TSLMaterial } from "$lib/materials";

export const BaseMaterial = (width: number, height: number) => {
	return new TSLMaterial(width, height, {
		draw(material, mouseX: number) {
			material.ctx.fillStyle = "#0000ff";
			material.ctx.fillRect(
				0,
				0,
				material.canvas.width,
				material.canvas.height
			);

			// Hue shift to visualise when the canvas is drawing vs when not
			const hue = (mouseX * 0.5) % 360;
			material.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
			material.ctx.font = `500 ${Math.max(material.canvas.width, material.canvas.height)}px "Times"`;
			material.ctx.textAlign = "center";
			material.ctx.textBaseline = "middle";

			material.ctx.fillText(
				"a",
				material.canvas.width / 2,
				material.canvas.height / 2
			);

			material.canvasTexture.needsUpdate = true;
		},
		outputNode: (canvasTexture) =>
			Fn(() => {
				return texture(canvasTexture, uv());
			})
	});
};
