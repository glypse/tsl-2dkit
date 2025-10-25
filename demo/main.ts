import "./style.css";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { BaseMaterial } from "./materials";
import { ExtendedOrthographicCamera } from "./utils";

let width = 800;
let height = 800;
let dpr = window.devicePixelRatio;
let clearColor = new THREE.Color(0xff0000);

const container = document.createElement("div");
container.style.resize = "both";
container.style.width = width + "px";
container.style.height = height + "px";
container.style.overflow = "hidden";
document.querySelector("#app")!.appendChild(container);

const scene = new THREE.Scene();

let forceWebGL = false;
let renderer = new WebGPURenderer({ forceWebGL });

function configRenderer(
	renderer: WebGPURenderer,
	width: number,
	height: number,
	dpr: number,
	clearColor: THREE.Color
) {
	renderer.setSize(width, height);
	renderer.setPixelRatio(dpr);
	renderer.setClearColor(clearColor);
}

configRenderer(renderer, width, height, dpr, clearColor);
container.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(1, 1);
const {
	material,
	draw: drawBaseMaterial,
	resize: resizeMaterial
} = BaseMaterial(width, height);
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

const planeSize = { w: width / 100, h: height / 100 };

plane.scale.set(planeSize.w, planeSize.h, 1);

const cameraPadding = 0;

const camera = new ExtendedOrthographicCamera(
	-planeSize.w / 2 - cameraPadding,
	planeSize.w / 2 + cameraPadding,
	planeSize.h / 2 + cameraPadding,
	-planeSize.h / 2 - cameraPadding,
	0.1,
	2
);
camera.position.z = 1;

let newWidth = width;
let newHeight = height;

const resizeObserver = new ResizeObserver(() => {
	newWidth = container.clientWidth;
	newHeight = container.clientHeight;
});
resizeObserver.observe(container);

function animate() {
	if (width !== newWidth || height !== newHeight) {
		width = newWidth;
		height = newHeight;
		renderer.setSize(newWidth, newHeight);
		const newPlaneSize = { w: newWidth / 100, h: newHeight / 100 };
		plane.scale.set(newPlaneSize.w, newPlaneSize.h, 1);
		camera.setSize(
			-newPlaneSize.w / 2 - cameraPadding,
			newPlaneSize.w / 2 + cameraPadding,
			newPlaneSize.h / 2 + cameraPadding,
			-newPlaneSize.h / 2 - cameraPadding
		);
		resizeMaterial(newWidth, newHeight);
	}
	drawBaseMaterial();
	renderer.renderAsync(scene, camera);
	requestAnimationFrame(animate);
}

animate();

// HELPER

const webGPUAvailable = "gpu" in navigator;

let helper = document.createElement("div");
if (webGPUAvailable) {
	document.querySelector("#app")!.appendChild(helper);

	const label = document.createElement("label");
	const checkbox: HTMLInputElement = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.checked = forceWebGL;
	checkbox.addEventListener("change", () => {
		forceWebGL = checkbox.checked;
		container.removeChild(renderer.domElement);
		renderer.dispose();
		renderer = new WebGPURenderer({ forceWebGL });
		configRenderer(renderer, width, height, dpr, clearColor);
		container.appendChild(renderer.domElement);
		if (webGPUAvailable) updateHelper();
	});
	label.appendChild(checkbox);
	label.appendChild(document.createTextNode(" Force WebGL"));
	document.querySelector("#app")!.appendChild(label);
} else {
	helper.textContent =
		"WebGPU unavailable in your browser. Use a WebGPU-compatible browser to fully observe this bug.";
	document.querySelector("#app")!.appendChild(helper);
}

function updateHelper() {
	helper.textContent = `Using: ${renderer.backend.constructor.name === "WebGPUBackend" ? "WebGPU" : "WebGL"}`;
}

if (webGPUAvailable) updateHelper();
