import * as THREE from "three";

export class ExtendedOrthographicCamera extends THREE.OrthographicCamera {
	setSize(left: number, right: number, top: number, bottom: number) {
		this.left = left;
		this.right = right;
		this.top = top;
		this.bottom = bottom;
		this.updateProjectionMatrix();
	}
}
