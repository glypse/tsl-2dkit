import {
	vec3,
	vec2,
	floor,
	fract,
	dot,
	float,
	abs,
	pow,
	select,
	int,
	If,
	Fn,
	exp,
	log,
	clamp,
	length,
	max
} from "three/tsl";
import { Node } from "three/webgpu";

function hash(p: Node): Node {
	const p3 = p.mul(vec3(0.1031, 0.103, 0.0973));
	const temp = p3.add(dot(p3, p3.add(vec3(19.19))));
	return fract(
		vec3(
			temp.x.add(temp.y).mul(temp.z),
			temp.x.add(temp.z).mul(temp.y),
			temp.y.add(temp.z).mul(temp.x)
		)
	);
}

const FEATURE_TO_INDEX = {
	f1: 0,
	f2: 1,
	edge: 2,
	smoothF1: 3,
	edgeProjected: 4
} as const;

const OUTPUT_TO_INDEX = {
	distance: 0,
	color: 1,
	position: 2
} as const;

const voronoiFn = Fn((inputs: [Node, Node, Node, Node, Node, Node, Node]) => {
	const [
		positionInput,
		exponentInput,
		featureInput,
		randomnessInput,
		smoothnessInput,
		outputModeInput,
		sliceNormalInput
	] = inputs;
	const exponentVar = float(exponentInput).toVar();
	const featureVar = int(featureInput).toVar();
	const randomnessVar = float(randomnessInput).toVar();
	const smoothnessVar = float(smoothnessInput).toVar();
	const outputModeVar = int(outputModeInput).toVar();
	const positionVar = vec3(positionInput).toVar();
	const sliceNormalVar = vec3(sliceNormalInput).toVar();
	const cell = floor(positionVar).toVar();
	const minima = vec2(1e10, 1e10).toVar();
	const closestSeed1 = vec3(0).toVar();
	const closestSeed2 = vec3(0).toVar();
	const sumExp = float(0).toVar();

	for (let i = -1; i <= 1; i++) {
		for (let j = -1; j <= 1; j++) {
			for (let k = -1; k <= 1; k++) {
				const offset = vec3(float(i), float(j), float(k));
				const neighborCell = cell.add(offset);
				const seed = neighborCell.add(
					hash(neighborCell).mul(randomnessVar)
				);
				const diff = positionVar.sub(seed);
				const metric = pow(
					abs(diff.x)
						.pow(exponentVar)
						.add(
							abs(diff.y)
								.pow(exponentVar)
								.add(abs(diff.z).pow(exponentVar))
						),
					float(1).div(exponentVar)
				);

				If(metric.lessThan(minima.x), () => {
					minima.y.assign(minima.x);
					minima.x.assign(metric);
					closestSeed2.assign(closestSeed1);
					closestSeed1.assign(seed);
				}).ElseIf(metric.lessThan(minima.y), () => {
					minima.y.assign(metric);
					closestSeed2.assign(seed);
				});

				const kSmooth = select(
					smoothnessVar.equal(float(0)),
					float(1000),
					float(1).div(smoothnessVar)
				);
				const expTerm = exp(metric.negate().mul(kSmooth));
				sumExp.addAssign(expTerm);
			}
		}
	}

	const smoothMin = select(
		smoothnessVar.equal(float(0)),
		minima.x,
		select(
			sumExp.lessThan(float(1e-10)),
			minima.x,
			log(sumExp).negate().div(float(1).div(smoothnessVar))
		)
	);

	const seedDelta = closestSeed2.sub(closestSeed1).toVar();
	const seedDeltaLength = length(seedDelta).toVar();
	const safeSeedDeltaLength = max(seedDeltaLength, float(1e-5));
	const edgePlaneNormal = seedDelta.div(safeSeedDeltaLength).toVar();
	const midpoint = closestSeed1.add(closestSeed2).mul(float(0.5)).toVar();
	const signedEdgeDistance = abs(
		dot(positionVar.sub(midpoint), edgePlaneNormal)
	).toVar();
	const sliceNormalLength = length(sliceNormalVar).toVar();
	const safeSliceNormalLength = max(sliceNormalLength, float(1e-5));
	const normalizedSliceNormal = sliceNormalVar
		.div(safeSliceNormalLength)
		.toVar();
	const tangentComponent = edgePlaneNormal
		.sub(
			normalizedSliceNormal.mul(
				dot(edgePlaneNormal, normalizedSliceNormal)
			)
		)
		.toVar();
	const tangentLength = length(tangentComponent).toVar();
	// Project the perpendicular distance into the slice plane so edge widths stay uniform.
	const planarEdgeDistance = select(
		tangentLength.lessThan(float(1e-5)),
		signedEdgeDistance,
		signedEdgeDistance.div(tangentLength)
	);

	const baseFeature = select(featureVar.equal(int(1)), minima.y, minima.x);
	const rawEdgeDistance = minima.y.sub(minima.x);
	const edgeOrF = select(
		featureVar.equal(int(2)),
		rawEdgeDistance,
		baseFeature
	);
	const smoothOrEdge = select(featureVar.equal(int(3)), smoothMin, edgeOrF);
	const value = select(
		featureVar.equal(int(4)),
		planarEdgeDistance,
		smoothOrEdge
	);

	const closestSeed = select(
		featureVar.equal(int(1)),
		closestSeed2,
		closestSeed1
	);
	const colorOutput = hash(closestSeed);
	const positionOutput = closestSeed;
	const distanceOutput = vec3(value, value, value);

	const outputValue = select(
		outputModeVar.equal(int(1)),
		colorOutput,
		select(outputModeVar.equal(int(2)), positionOutput, distanceOutput)
	);

	return outputValue;
}).setLayout({
	name: "voronoi",
	type: "vec3",
	inputs: [
		{ name: "position", type: "vec3" },
		{ name: "exponent", type: "float" },
		{ name: "featureOutput", type: "int" },
		{ name: "randomness", type: "float" },
		{ name: "smoothness", type: "float" },
		{ name: "outputMode", type: "int" },
		{ name: "sliceNormal", type: "vec3" }
	]
});

export function voronoi(
	position: Node,
	opts: {
		exponent?: Node;
		featureOutput?: "f1" | "f2" | "edge" | "smoothF1" | "edgeProjected";
		randomness?: Node;
		smoothness?: Node;
		outputMode?: "distance" | "color" | "position";
		sliceNormal?: Node;
	} = {}
): Node {
	const exponent = opts.exponent ?? float(2);
	const feature = opts.featureOutput ?? "f1";
	const randomness = opts.randomness ?? float(1);
	const smoothness = clamp(opts.smoothness ?? float(0), float(0), float(1));
	const outputMode = opts.outputMode ?? "distance";
	const sliceNormal = opts.sliceNormal ?? vec3(0, 0, 1);
	const featureIndex = FEATURE_TO_INDEX[feature];
	const featureNode = int(featureIndex);
	const outputModeIndex = OUTPUT_TO_INDEX[outputMode];
	const outputModeNode = int(outputModeIndex);
	return voronoiFn(
		position,
		exponent,
		featureNode,
		randomness,
		smoothness,
		outputModeNode,
		sliceNormal
	);
}
