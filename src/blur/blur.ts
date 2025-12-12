import {
	Fn,
	vec2,
	vec4,
	uv,
	texture,
	textureSize,
	Loop,
	float,
	int,
	floor,
	max,
	convertToTexture,
	exp
} from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";

function createBoxBlurPass(axis: "x" | "y") {
	return Fn(([textureNode, blurAmountMap]: [TextureNode, Node]) => {
		const baseUV = (textureNode.uvNode ?? uv()).toVar();
		const pixelSize = vec2(1).div(textureSize(textureNode)).toVar();
		const blurAmount = float(blurAmountMap).toVar();
		const safeRadius = max(float(0), blurAmount).toVar();
		const flooredRadius = floor(safeRadius).toVar();
		const radiusInt = int(flooredRadius).toVar();
		const kernelSize = radiusInt.mul(2).add(int(1)).toVar();
		const kernelSizeFloat = float(kernelSize).toVar();
		const accumulator = vec4(0).toVar();

		Loop(
			{
				start: radiusInt.negate(),
				end: radiusInt,
				name: "i",
				condition: "<="
			},
			({ i }) => {
				const offset = vec2(
					axis === "x" ? float(i) : float(0),
					axis === "y" ? float(i) : float(0)
				)
					.mul(pixelSize)
					.toVar();
				const sampleUV = baseUV.add(offset);
				const sample = texture(textureNode, sampleUV);
				accumulator.addAssign(sample);
			}
		);

		return accumulator.mul(float(1).div(kernelSizeFloat));
	});
}

function createGaussianBlurPass(axis: "x" | "y") {
	return Fn(([textureNode, blurAmountMap]: [TextureNode, Node]) => {
		const baseUV = (textureNode.uvNode ?? uv()).toVar();
		const pixelSize = vec2(1).div(textureSize(textureNode)).toVar();

		// Sample the blur amount map at current UV
		const blurAmount = float(blurAmountMap).toVar();
		const safeRadius = max(float(0), blurAmount).toVar();
		const flooredRadius = floor(safeRadius).toVar();
		const radiusInt = int(flooredRadius).toVar();
		const sigma = safeRadius.div(float(3)).toVar();
		const twoSigmaSq = sigma.mul(sigma).mul(2).toVar();
		const weightedSum = vec4(0).toVar();
		const totalWeight = float(0).toVar();

		Loop(
			{
				start: radiusInt.negate(),
				end: radiusInt,
				name: "i",
				condition: "<="
			},
			({ i }) => {
				const weight = exp(
					float(i).mul(float(i)).negate().div(twoSigmaSq)
				);
				totalWeight.addAssign(weight);
				const offset = vec2(
					axis === "x" ? float(i) : float(0),
					axis === "y" ? float(i) : float(0)
				)
					.mul(pixelSize)
					.toVar();
				const sampleUV = baseUV.add(offset);
				const sample = texture(textureNode, sampleUV);
				weightedSum.addAssign(sample.mul(weight));
			}
		);

		return weightedSum.div(totalWeight);
	});
}

const horizontalBoxBlurPass = createBoxBlurPass("x");
const verticalBoxBlurPass = createBoxBlurPass("y");
const horizontalGaussianBlurPass = createGaussianBlurPass("x");
const verticalGaussianBlurPass = createGaussianBlurPass("y");

/**
 * Applies a separable box blur where the blur radius is controlled per-pixel
 * by a blur amount map.
 *
 * @param value - The input node to blur
 * @param blurAmountMap - A Node that determines the blur radius at each pixel
 * @returns The blurred result as a Node
 */
export function boxBlur(value: Node, blurAmountMap: Node) {
	const blurAmountNode = blurAmountMap;
	const sourceTexture = convertToTexture(value);
	const horizontalBlurred = horizontalBoxBlurPass(
		sourceTexture,
		blurAmountNode
	);
	const horizontalTexture = convertToTexture(horizontalBlurred);
	return verticalBoxBlurPass(horizontalTexture, blurAmountNode);
}

/**
 * Applies a separable Gaussian blur where the blur radius is controlled per-pixel
 * by a blur amount map.
 *
 * @param value - The input node to blur
 * @param blurAmountMap - A Node that determines the blur radius at each pixel
 * @returns The blurred result as a Node
 */
export function gaussianBlur(value: Node, blurAmountMap: Node) {
	const blurAmountNode = blurAmountMap;
	const sourceTexture = convertToTexture(value);
	const horizontalBlurred = horizontalGaussianBlurPass(
		sourceTexture,
		blurAmountNode
	);
	const horizontalTexture = convertToTexture(horizontalBlurred);
	return verticalGaussianBlurPass(horizontalTexture, blurAmountNode);
}
