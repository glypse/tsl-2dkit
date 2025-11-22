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
	Fn
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
	edge: 2
} as const;

const voronoiFn = Fn((inputs: [Node, Node, Node]) => {
	const [positionInput, exponentInput, featureInput] = inputs;
	const exponentVar = float(exponentInput).toVar();
	const featureVar = int(featureInput).toVar();
	const positionVar = vec3(positionInput).toVar();
	const cell = floor(positionVar).toVar();
	const minima = vec2(1e10, 1e10).toVar();

	for (let i = -1; i <= 1; i++) {
		for (let j = -1; j <= 1; j++) {
			for (let k = -1; k <= 1; k++) {
				const offset = vec3(float(i), float(j), float(k));
				const neighborCell = cell.add(offset);
				const seed = neighborCell.add(hash(neighborCell));
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
				}).ElseIf(metric.lessThan(minima.y), () => {
					minima.y.assign(metric);
				});
			}
		}
	}

	const baseFeature = select(featureVar.equal(int(1)), minima.y, minima.x);
	return select(
		featureVar.equal(int(2)),
		minima.y.sub(minima.x),
		baseFeature
	);
}).setLayout({
	name: "voronoi",
	type: "float",
	inputs: [
		{ name: "position", type: "vec3" },
		{ name: "exponent", type: "float" },
		{ name: "featureOutput", type: "int" }
	]
});

export function voronoi(
	position: Node,
	opts: { exponent?: Node; featureOutput?: "f1" | "f2" | "edge" } = {}
): Node {
	const exponent = opts.exponent ?? float(2);
	const feature = opts.featureOutput ?? "f1";
	const featureIndex = FEATURE_TO_INDEX[feature];
	const featureNode = int(featureIndex);
	return voronoiFn(position, exponent, featureNode);
}
