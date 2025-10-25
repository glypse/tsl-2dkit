import { Fn, uv, texture } from "three/tsl";
import { TSLMaterial } from "$lib/materials";

export const BaseMaterial = (width: number, height: number) => {
	return new TSLMaterial(width, height, {
		draw(mouseX: number) {
			this.ctx.fillStyle = "#0000ff";
			this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

			// Hue shift to visualise when the canvas is drawing vs when not
			const hue = (mouseX * 0.5) % 360;
			this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
			this.ctx.font = `500 ${Math.max(this.canvas.width, this.canvas.height)}px "Times"`;
			this.ctx.textAlign = "center";
			this.ctx.textBaseline = "middle";

			this.ctx.fillText(
				"a",
				this.canvas.width / 2,
				this.canvas.height / 2
			);

			this.canvasTexture.needsUpdate = true;
		},
		outputNode: (canvasTexture) =>
			Fn(() => {
				return texture(canvasTexture, uv());
			})
	});
};
