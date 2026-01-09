import {
	Fn,
	vec2,
	texture,
	uv,
	textureSize,
	convertToTexture,
	floor,
	float,
	int,
	Loop,
	select,
	min,
	max
} from "three/tsl";
import { type Node } from "three/webgpu";

const ITERATIONS = 6;

const medianFn = Fn(
	([inputTexture, sizeInput]: [
		ReturnType<typeof convertToTexture>,
		Node
	]) => {
		const texSize = textureSize(inputTexture);
		const pixelSize = vec2(1).div(texSize).toVar();
		const baseUV = uv();

		const safeSize = max(float(1), sizeInput).toVar();
		const flooredSize = floor(safeSize).toVar();
		const sizeInt = int(flooredSize).toVar();
		const isEven = sizeInt.mod(int(2)).equal(int(0));
		const kernelSizeInt = select(
			isEven,
			sizeInt.add(int(1)),
			sizeInt
		).toVar();
		const radiusInt = kernelSizeInt.sub(int(1)).div(int(2)).toVar();
		const totalSamples = kernelSizeInt.mul(kernelSizeInt).toVar();
		const targetRank = totalSamples.div(int(2)).toVar();

		const minBound = float(1e10).toVar();
		const maxBound = float(-1e10).toVar();

		Loop(totalSamples, ({ i }) => {
			const x = i.mod(kernelSizeInt).sub(radiusInt);
			const y = i.div(kernelSizeInt).sub(radiusInt);
			const offset = vec2(float(x), float(y));
			const sampleUV = baseUV.add(offset.mul(pixelSize));
			const sample = texture(inputTexture, sampleUV).x;
			minBound.assign(min(minBound, sample));
			maxBound.assign(max(maxBound, sample));
		});

		Loop(int(ITERATIONS), () => {
			const mid = minBound.add(maxBound).mul(float(0.5)).toVar();
			const lessOrEqualCount = int(0).toVar();
			Loop(totalSamples, ({ i }) => {
				const x = i.mod(kernelSizeInt).sub(radiusInt);
				const y = i.div(kernelSizeInt).sub(radiusInt);
				const offset = vec2(float(x), float(y));
				const sampleUV = baseUV.add(offset.mul(pixelSize));
				const sample = texture(inputTexture, sampleUV).x;
				const increment = select(
					sample.lessThanEqual(mid),
					int(1),
					int(0)
				);
				lessOrEqualCount.assign(lessOrEqualCount.add(increment));
			});
			const shouldTightenUpper = lessOrEqualCount.greaterThan(targetRank);
			maxBound.assign(select(shouldTightenUpper, mid, maxBound));
			minBound.assign(select(shouldTightenUpper, minBound, mid));
		});

		return minBound.add(maxBound).mul(float(0.5));
	}
).setLayout({
	name: "median",
	type: "float",
	inputs: [
		{ name: "texture", type: "texture" },
		{ name: "size", type: "float" }
	]
});

/**
 * Applies a median filter to the input value using an iterative binary search
 * algorithm. The median filter is useful for noise reduction while preserving
 * edges. Uses a square kernel of the specified size.
 *
 * @param value - The input node or texture to filter
 * @param size - The kernel size (will be adjusted to nearest odd number if
 *   even)
 * @returns A node containing the median-filtered result
 */
export function median(value: Node, size: Node): Node {
	const textureValue = convertToTexture(value);
	return medianFn(textureValue, size);
}
