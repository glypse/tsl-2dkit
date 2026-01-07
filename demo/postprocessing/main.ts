/**
 * TSLPass Post-Processing Demo
 *
 * Demonstrates how to use TSLPass to integrate tsl-2dkit effects
 * into Three.js's PostProcessing pipeline.
 *
 * Pipeline:
 * 1. Scene pass (renders 3D cubes)
 * 2. TSLPass (applies a color shift effect)
 * 3. Bloom pass (adds glow to bright areas)
 */

import "$demo/style.css";

import * as THREE from "three/webgpu";
import { pass, vec3, uv, sin, time, mix } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { TextTexture, tslPass } from "$lib";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Setup renderer
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
await renderer.init();

// Setup scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Setup camera
const camera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	100
);
camera.position.set(0, 2, 5);

// Setup controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Add some cubes
const geometry = new THREE.BoxGeometry(1, 1, 1);
const cubes: THREE.Mesh[] = [];

for (let i = 0; i < 10; i++) {
	const hue = i / 10;
	const material = new THREE.MeshStandardMaterial({
		color: new THREE.Color().setHSL(hue, 0.8, 0.5),
		emissive: new THREE.Color().setHSL(hue, 0.8, 0.3),
		emissiveIntensity: 0.5
	});

	const cube = new THREE.Mesh(geometry, material);
	cube.position.set(
		(Math.random() - 0.5) * 6,
		(Math.random() - 0.5) * 4,
		(Math.random() - 0.5) * 6
	);
	cube.rotation.set(
		Math.random() * Math.PI,
		Math.random() * Math.PI,
		Math.random() * Math.PI
	);
	scene.add(cube);
	cubes.push(cube);
}

// Add lights
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 50);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// Setup post-processing
const postProcessing = new THREE.PostProcessing(renderer);

// 1. Scene pass - renders the 3D scene
const scenePass = pass(scene, camera);

const textTexture = new TextTexture({
	text: "a",
	size: Math.min(window.innerWidth, window.innerHeight),
	// Initial value, not reactive value
	weight: 500,
	color: "#00ff00",
	fontFamily: "Fustat",
	debug: true,
	padding: 0
});

// Get the scene pass texture
const scenePassColor = scenePass.getTextureNode("output");

// 2. TSLPass - our custom 2D effect using tslPass functional API
// This creates a color shift/tint effect that oscillates over time
// Size and texture updates are handled automatically!
const colorShiftedScene = tslPass(scenePassColor, (input) => {
	const UV = uv();

	const textSample = textTexture.sample(UV.sub(0.5));
	const sampled = input.sample(UV);

	// Create a time-based color shift
	const shift = sin(time.mul(2)).mul(0.1);

	// Apply warm/cool color grading based on position
	const warmth = UV.x.sub(0.5).mul(0.3);

	const colorShifted = vec3(
		sampled.r.add(shift).add(warmth),
		sampled.g,
		sampled.b.sub(shift).sub(warmth)
	);

	const final = mix(colorShifted, textSample.rgb, textSample.a);

	return vec3(final);
});

// 3. Bloom pass - adds glow after our effect
const bloomPass = bloom(colorShiftedScene, 0.5, 0.4, 0.1);

// Combine: scene + bloom
postProcessing.outputNode = colorShiftedScene.add(bloomPass);

// Handle resize
window.addEventListener("resize", () => {
	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize(width, height);
	// TSLPass automatically handles size updates from renderer!
});

// Animation loop
function animate(): void {
	// Rotate cubes
	const t = performance.now() * 0.001;
	cubes.forEach((cube, i) => {
		cube.rotation.x = t * (0.5 + i * 0.1);
		cube.rotation.y = t * (0.3 + i * 0.1);
	});

	controls.update();

	// TSLPass automatically updates textures before each frame!
	postProcessing.render();
}

void renderer.setAnimationLoop(animate);

// Info
const info = document.createElement("div");
info.style.cssText =
	"position:fixed;top:10px;left:10px;color:white;font-family:monospace;background:rgba(0,0,0,0.5);padding:10px;border-radius:4px;";
info.innerHTML = `
<strong>TSLPass Post-Processing Demo</strong><br>
Pipeline: Scene → TSLPass (color shift) → Bloom<br>
Drag to rotate camera
`;
document.body.appendChild(info);
