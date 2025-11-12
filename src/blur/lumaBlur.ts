import {
	float,
	Fn,
	vec2,
	uv,
	sin,
	rand,
	degrees,
	cos,
	Loop,
	type ProxiedObject
} from "three/tsl";
import { Node } from "three/webgpu";
import type { ShaderNodeFn } from "three/src/nodes/TSL.js";

/**
 * Applies a luma blur effect to the result of a given function.
 *
 * This blur technique samples the input function multiple times in a circular pattern
 * and averages the results. The blur amount can be controlled by a map/texture for
 * progressive or variable blur effects.
 *
 * Based on the tutorial: https://tympanus.net/codrops/2024/07/02/progressive-blur-effect-using-webgl-with-ogl-and-glsl-shaders/
 *
 * @param inputFn - A function that takes a uv Node parameter and returns a Node representing a color or value
 * @param blurAmountMap - A Node that determines the amount of blur at each pixel
 * @param options - Additional options for the blur effect
 * @param options.repeats - The number of iterations for the blur effect (default: 40)
 * @returns The blurred result as a Node
 */
export const lumaBlur = Fn(
	([inputFn, blurAmountMap, options]: [
		ShaderNodeFn<[ProxiedObject<Node>]>,
		Node,
		{ repeats?: Node }?
	]) => {
		const repeats = options?.repeats ?? float(40);

		const targetUV = uv();

		const blurred = float(0);

		Loop({ start: float(0), end: repeats, type: "float" }, ({ i }) => {
			const angle = degrees(i.div(repeats).mul(360));

			// First sample
			const rand1 = rand(vec2(i, targetUV.x.add(targetUV.y)));
			const q1 = vec2(cos(angle), sin(angle)).mul(rand1.add(1));
			const uv2_1 = targetUV.add(q1.mul(blurAmountMap));
			const sample1 = inputFn(uv2_1);
			blurred.addAssign(sample1.div(2));

			// Second sample
			const rand2 = rand(
				vec2(i.add(2), targetUV.x.add(targetUV.y).add(24))
			);
			const q2 = vec2(cos(angle), sin(angle)).mul(rand2.add(1));
			const uv2_2 = targetUV.add(q2.mul(blurAmountMap));
			const sample2 = inputFn(uv2_2);
			blurred.addAssign(sample2.div(2));
		});

		blurred.divAssign(repeats);

		return blurred;
	}
);
