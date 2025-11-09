import {
	Fn,
	vec2,
	uv,
	Loop,
	vec4,
	premultiplyAlpha,
	unpremultiplyAlpha,
	int,
	textureSize,
	nodeObject,
	convertToTexture
} from "three/tsl";

/**
 * Applies a luma-aware blur effect using a fast Kawase-like algorithm.
 *
 * This blur is optimized for performance with large blur amounts by using a fixed number of samples
 * scaled by the blur map. It's suitable for spatially varying blur where the blur amount changes per pixel.
 *
 * The algorithm approximates a Gaussian blur with fewer samples than traditional box blur, making it
 * efficient for high blur radii.
 *
 * @tsl
 * @function
 * @param {Node<vec4>} textureNode - The texture node that should be blurred.
 * @param {Node<float>} blurMap - The blur amount per pixel (radius scaling factor).
 * @param {Object} [options={}] - Additional options for the blur effect.
 * @param {boolean} [options.premultipliedAlpha=false] - Whether to use premultiplied alpha for the blur effect.
 * @param {Node<int>} [options.maxIterations=int(8)] - The number of iterations for the blur (fixed for performance).
 * @return {Node<vec4>} The blurred texture node.
 */
export const lumaBlur = /*#__PURE__*/ Fn(
	([textureNode, blurMap, options = {}]) => {
		textureNode = convertToTexture(textureNode);

		const blurAmount = nodeObject(blurMap);
		const premultipliedAlpha = options.premultipliedAlpha ?? false;
		const maxIterations = nodeObject(options.maxIterations) ?? int(8);

		const tap = (uv) => {
			const sample = textureNode.sample(uv);

			return premultipliedAlpha ? premultiplyAlpha(sample) : sample;
		};

		const targetUV = textureNode.uvNode ?? uv();

		let result = tap(targetUV);
		const pixelStep = vec2(1).div(textureSize(textureNode));

		Loop(
			{ start: int(1), end: maxIterations.add(1), name: "i" },
			({ i }) => {
				const offset = vec2(i, i).mul(pixelStep).mul(blurAmount);

				result.addAssign(tap(targetUV.add(offset)));
				result.addAssign(tap(targetUV.add(offset.mul(vec2(-1, 1)))));
				result.addAssign(tap(targetUV.add(offset.mul(vec2(1, -1)))));
				result.addAssign(tap(targetUV.add(offset.mul(vec2(-1, -1)))));
			}
		);

		result.divAssign(maxIterations.mul(4).add(1));

		return premultipliedAlpha ? unpremultiplyAlpha(result) : result;
	}
);
