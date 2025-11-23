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
	nodeObject,
	convertToTexture,
	exp
} from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";

function createBoxBlurPass(axis: "x" | "y") {
	return Fn(([textureNode, radiusInput]: [TextureNode, Node]) => {
		const baseUV = (textureNode.uvNode ?? uv()).toVar();
		const pixelSize = vec2(1).div(textureSize(textureNode)).toVar();
		const safeRadius = max(float(0), radiusInput).toVar();
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
	return Fn(([textureNode, radiusInput]: [TextureNode, Node]) => {
		const baseUV = (textureNode.uvNode ?? uv()).toVar();
		const pixelSize = vec2(1).div(textureSize(textureNode)).toVar();
		const safeRadius = max(float(0), radiusInput).toVar();
		const flooredRadius = floor(safeRadius).toVar();
		const radiusInt = int(flooredRadius).toVar();
		const sigma = safeRadius.div(float(3)).toVar(); // Approximate sigma from radius
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
 * Applies a uniform separable box blur to the provided node.
 * Performs a horizontal pass followed by a vertical pass, which scales
 * linearly with the radius instead of quadratically.
 */
export function boxBlur(value: Node, radius: Node | number = 1) {
	const radiusNode = nodeObject(radius);
	const sourceTexture = convertToTexture(value);
	const horizontalBlurred = horizontalBoxBlurPass(sourceTexture, radiusNode);
	const horizontalTexture = convertToTexture(horizontalBlurred);
	return verticalBoxBlurPass(horizontalTexture, radiusNode);
}

/**
 * Applies a separable Gaussian blur to the provided node.
 * Performs a horizontal pass followed by a vertical pass, using Gaussian weights.
 */
export function gaussianBlur(value: Node, radius: Node | number = 1) {
	const radiusNode = nodeObject(radius);
	const sourceTexture = convertToTexture(value);
	const horizontalBlurred = horizontalGaussianBlurPass(
		sourceTexture,
		radiusNode
	);
	const horizontalTexture = convertToTexture(horizontalBlurred);
	return verticalGaussianBlurPass(horizontalTexture, radiusNode);
}
