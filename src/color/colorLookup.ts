import { vec2, texture, clamp } from "three/tsl";
import { Texture } from "three";
import { type FloatNode, type Vec3Node } from "../core/materials";
import { interpolate, converter, type Mode } from "culori";

export function colorLookup(value: FloatNode, mapTexture: Texture): Vec3Node {
	const clampedValue = clamp(value, 0, 1);
	const sampleUV = vec2(clampedValue, 0.5);
	return texture(mapTexture, sampleUV).rgb as Vec3Node;
}

export function gradient(
	stops: Array<{ position: number; color: string }>,
	opts: { width?: number; height?: number; mode?: Mode } = {
		width: 256,
		height: 1,
		mode: "rgb"
	}
): Texture {
	const width = opts.width ?? 256;
	const height = opts.height ?? 1;
	const mode = opts.mode ?? "rgb";

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;

	if (mode === "rgb") {
		const grad = ctx.createLinearGradient(0, 0, width, 0);
		for (const stop of stops) {
			grad.addColorStop(stop.position, stop.color);
		}
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, width, height);
	} else {
		const convertRgb = converter("rgb");
		const sortedStops = stops.sort((a, b) => a.position - b.position);
		for (let x = 0; x < width; x++) {
			const t = x / (width - 1);
			let color;
			if (t <= sortedStops[0].position) {
				color = interpolate([sortedStops[0].color], mode)(0);
			} else if (t >= sortedStops[sortedStops.length - 1].position) {
				color = interpolate(
					[sortedStops[sortedStops.length - 1].color],
					mode
				)(0);
			} else {
				for (let i = 0; i < sortedStops.length - 1; i++) {
					if (
						t >= sortedStops[i].position &&
						t <= sortedStops[i + 1].position
					) {
						const localT =
							(t - sortedStops[i].position) /
							(sortedStops[i + 1].position -
								sortedStops[i].position);
						const interp = interpolate(
							[sortedStops[i].color, sortedStops[i + 1].color],
							mode
						);
						color = interp(localT);
						break;
					}
				}
			}
			const rgb = convertRgb(color) ?? { r: 0, g: 0, b: 0 };
			ctx.fillStyle = `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`;
			ctx.fillRect(x, 0, 1, height);
		}
	}
	const texture = new Texture(canvas);
	texture.needsUpdate = true;
	return texture;
}
