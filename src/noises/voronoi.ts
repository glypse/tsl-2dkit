import { vec3, floor, fract, dot, length, min, float } from "three/tsl";
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

export function voronoi(position: Node): Node {
	const p = position;
	const cell = floor(p);
	let minDist: Node = float(1e10);

	for (let i = -1; i <= 1; i++) {
		for (let j = -1; j <= 1; j++) {
			for (let k = -1; k <= 1; k++) {
				const offset = vec3(i, j, k);
				const neighborCell = cell.add(offset);
				const seed = neighborCell.add(hash(neighborCell));
				const dist = length(p.sub(seed));
				minDist = min(minDist, dist);
			}
		}
	}

	return minDist;
}
