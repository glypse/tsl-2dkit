import { clamp, texture, vec2, type ProxiedObject } from "three/tsl";
import { Texture } from "three";
import { Node } from "three/webgpu";
import { interpolate, converter, type Mode } from "culori";
import type { ShaderNodeFn } from "three/src/nodes/TSL.js";

export function colorLookup(
	value: Node,
	gradient: ShaderNodeFn<[ProxiedObject<{ t: Node }>]> | Texture
): Node {
	const clampedValue = clamp(value, 0, 1);
	if (gradient instanceof Texture) {
		const sampleUV = vec2(clampedValue, 0.5);
		return texture(gradient, sampleUV);
	} else {
		return gradient({ t: clampedValue });
	}
}

export function gradient(
	stops: { position: number; color: string }[],
	parameters: { width?: number; height?: number; mode?: Mode } = {
		width: 256,
		height: 1,
		mode: "rgb"
	}
): Texture {
	const width = parameters.width ?? 256;
	const height = parameters.height ?? 1;
	const mode = parameters.mode ?? "rgb";

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d context not supported");

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
			ctx.fillStyle = `rgb(${Math.round(rgb.r * 255).toString()}, ${Math.round(rgb.g * 255).toString()}, ${Math.round(rgb.b * 255).toString()})`;
			ctx.fillRect(x, 0, 1, height);
		}
	}
	const texture = new Texture(canvas);
	texture.needsUpdate = true;
	return texture;
}
