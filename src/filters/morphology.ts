import {
	Fn,
	vec2,
	float,
	uv,
	texture,
	Loop,
	max,
	floor,
	length,
	select,
	textureSize,
	bool,
	convertToTexture,
	int,
	min
} from "three/tsl";
import { type Node, type TextureNode } from "three/webgpu";

const dilateFn = Fn(([tex, radius, isRound]: [TextureNode, Node, Node]) => {
	const texSize = textureSize(tex);
	const pixelSize = vec2(1).div(texSize);
	const r = floor(radius).toVar();
	const rInt = int(r).toVar();
	const size = rInt.mul(2).add(1).toVar();
	const maxVal = float(-1e10).toVar();
	Loop(size.mul(size), ({ i }) => {
		const x = i.mod(size).sub(rInt);
		const y = i.div(size).sub(rInt);
		const offset = vec2(float(x), float(y)).toVar();
		const dist = length(offset);
		const sampleUV = uv().add(offset.mul(pixelSize));
		const sample = texture(tex, sampleUV).x;
		const shouldInclude = select(
			isRound,
			dist.lessThanEqual(r),
			bool(true)
		);
		maxVal.assign(select(shouldInclude, max(maxVal, sample), maxVal));
	});
	return maxVal;
});

/**
 * Applies a morphological dilation operation to the input texture. Dilation
 * expands bright regions by taking the maximum value within the kernel radius.
 * Can use either a square or circular kernel.
 *
 * @param tex - The input node or texture to dilate
 * @param parameters - Configuration for the dilation operation
 * @returns A node containing the dilated result
 */
export function dilate(
	tex: Node,
	parameters: {
		radius: Node;
		/** @defaultValue bool(false) */
		isRound?: Node;
	}
): Node {
	const realTex = convertToTexture(tex);
	const radius = parameters.radius;
	const isRound = parameters.isRound ?? bool(false);
	return dilateFn(realTex, radius, isRound);
}

const erodeFn = Fn(([tex, radius, isRound]: [TextureNode, Node, Node]) => {
	const texSize = textureSize(tex);
	const pixelSize = vec2(1).div(texSize);
	const r = floor(radius).toVar();
	const rInt = int(r).toVar();
	const size = rInt.mul(2).add(1).toVar();
	const minVal = float(1e10).toVar();
	Loop(size.mul(size), ({ i }) => {
		const x = i.mod(size).sub(rInt);
		const y = i.div(size).sub(rInt);
		const offset = vec2(float(x), float(y)).toVar();
		const dist = length(offset);
		const sampleUV = uv().add(offset.mul(pixelSize));
		const sample = texture(tex, sampleUV).x;
		const shouldInclude = select(
			isRound,
			dist.lessThanEqual(r),
			bool(true)
		);
		minVal.assign(select(shouldInclude, min(minVal, sample), minVal));
	});
	return minVal;
});

/**
 * Applies a morphological erosion operation to the input texture. Erosion
 * shrinks bright regions by taking the minimum value within the kernel radius.
 * Can use either a square or circular kernel.
 *
 * @param tex - The input node or texture to erode
 * @param parameters - Configuration for the erosion operation
 * @returns A node containing the eroded result
 */
export function erode(
	tex: Node,
	parameters: {
		radius: Node;
		/** @defaultValue bool(false) */
		isRound?: Node;
	}
): Node {
	const realTex = convertToTexture(tex);
	const radius = parameters.radius;
	const isRound = parameters.isRound ?? bool(false);
	return erodeFn(realTex, radius, isRound);
}
