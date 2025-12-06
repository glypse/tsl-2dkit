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
import { Node, TextureNode } from "three/webgpu";

const maximumFn = Fn(([tex, radius, isRound]: [TextureNode, Node, Node]) => {
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

export function maximum(tex: Node, opts: { radius: Node; isRound?: Node }) {
	const realTex = convertToTexture(tex);
	const radius = opts.radius;
	const isRound = opts.isRound ?? bool(false);
	return maximumFn(realTex, radius, isRound);
}

const minimumFn = Fn(([tex, radius, isRound]: [TextureNode, Node, Node]) => {
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

export function minimum(tex: Node, opts: { radius: Node; isRound?: Node }) {
	const realTex = convertToTexture(tex);
	const radius = opts.radius;
	const isRound = opts.isRound ?? bool(false);
	return minimumFn(realTex, radius, isRound);
}
