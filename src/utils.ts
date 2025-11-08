import { float, vec2 } from "three/tsl";
import { Node } from "three/webgpu";

export function getAspectCorrectedUV(
	uv: Node,
	canvasSize: Node,
	fit: "cover" | "contain" | "stretch" = "cover"
) {
	if (fit == "stretch") {
		return uv;
	}

	const aspectRatio = canvasSize.x.div(canvasSize.y);

	// Center the UVs around (0.5, 0.5)
	const centeredUV = uv.sub(vec2(0.5, 0.5));

	let scaleX: Node;
	let scaleY: Node;

	if (fit == "cover") {
		scaleX = aspectRatio.lessThan(1).select(aspectRatio, float(1));
		scaleY = aspectRatio
			.greaterThan(1)
			.select(float(1).div(aspectRatio), float(1));
	} else {
		scaleX = aspectRatio.greaterThan(1).select(aspectRatio, float(1));
		scaleY = aspectRatio
			.lessThan(1)
			.select(float(1).div(aspectRatio), float(1));
	}

	const correctedUV = vec2(
		centeredUV.x.mul(scaleX),
		centeredUV.y.mul(scaleY)
	).add(vec2(0.5, 0.5));

	return correctedUV;
}
