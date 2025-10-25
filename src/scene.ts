import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import type { TSLMaterial } from "./materials";

function configRenderer(
	renderer: WebGPURenderer,
	width: number,
	height: number,
	dpr: number
) {
	renderer.setSize(width, height);
	renderer.setPixelRatio(dpr);
}

export function Scene2D(
	parentNode: HTMLElement,
	width: number,
	height: number,
	materialInfo: TSLMaterial,
	resizeable?: boolean,
	forceWebGL = false
) {
	const scene = new THREE.Scene();
	const renderer = new WebGPURenderer({ forceWebGL });
	renderer.setClearColor(new THREE.Color(0x808080));

	const { material, resize: resizeMaterial } = materialInfo;

	let container: HTMLDivElement | undefined;

	if (resizeable) {
		container = document.createElement("div");
		container.style.resize = "both";
		container.style.width = width + "px";
		container.style.height = height + "px";
		container.style.overflow = "hidden";
		parentNode.appendChild(container);
		container.appendChild(renderer.domElement);
	} else {
		parentNode.appendChild(renderer.domElement);
	}

	configRenderer(renderer, width, height, window.devicePixelRatio);

	const geometry = new THREE.PlaneGeometry(1, 1);
	const plane = new THREE.Mesh(geometry, material);
	scene.add(plane);

	const planeSize = { w: width / 100, h: height / 100 };

	plane.scale.set(planeSize.w, planeSize.h, 1);

	const camera = new THREE.OrthographicCamera(
		-planeSize.w / 2,
		planeSize.w / 2,
		planeSize.h / 2,
		-planeSize.h / 2,
		0.1,
		2
	);
	camera.position.z = 1;

	let newWidth = width;
	let newHeight = height;

	const resizeObserver = resizeable
		? new ResizeObserver(() => {
				if (container) {
					newWidth = container.clientWidth;
					newHeight = container.clientHeight;
				}
			})
		: null;

	if (resizeObserver && container) {
		resizeObserver.observe(container);
	}

	function onResize(newW: number, newH: number) {
		configRenderer(renderer, newW, newH, window.devicePixelRatio);
		const newPlaneSize = { w: newW / 100, h: newH / 100 };
		plane.scale.set(newPlaneSize.w, newPlaneSize.h, 1);
		camera.left = -newPlaneSize.w / 2;
		camera.right = newPlaneSize.w / 2;
		camera.top = newPlaneSize.h / 2;
		camera.bottom = -newPlaneSize.h / 2;
		camera.updateProjectionMatrix();
		resizeMaterial(newW, newH);
	}

	function animate() {
		if (width !== newWidth || height !== newHeight) {
			width = newWidth;
			height = newHeight;
			onResize(newWidth, newHeight);
		}
		requestAnimationFrame(animate);
	}

	animate();

	const canvas = renderer.domElement;

	function onDrawScene(drawFn: () => void) {
		function animate() {
			drawFn();
			renderer.renderAsync(scene, camera);
			requestAnimationFrame(animate);
		}
		animate();
	}

	return {
		canvas,
		onDrawScene,
		onResize
	};
}
