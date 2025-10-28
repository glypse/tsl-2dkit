import * as THREE from "three";
import { CanvasTexture, WebGPURenderer } from "three/webgpu";
import { Fn, texture, uv, mix, vec4 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { type TSLMaterial } from "./materials";
import { initCanvas, handleCanvasResize } from "./canvas";
import { DrawingContext, setDrawingContext } from "./drawing";

function configRenderer(
	renderer: WebGPURenderer,
	width: number,
	height: number,
	dpr: number
) {
	renderer.setSize(width, height);
	renderer.setPixelRatio(dpr);
}

function Scene2D(
	parentNode: HTMLElement,
	width: number,
	height: number,
	TSLMaterial: TSLMaterial,
	resizeable = false,
	forceWebGL = false
) {
	const scene = new THREE.Scene();
	const renderer = new WebGPURenderer({ forceWebGL });
	renderer.setClearColor(new THREE.Color(0x808080));

	const { material, resize: resizeMaterial } = TSLMaterial;

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

export class Canvas2D {
	private scene2D: ReturnType<typeof Scene2D>;
	private drawingContext: DrawingContext;
	private material: MeshBasicNodeMaterial;
	private canvasTexture: CanvasTexture;

	constructor(parentNode: HTMLElement, width: number, height: number) {
		const { ctx, canvasTexture } = initCanvas(width, height);
		this.canvasTexture = canvasTexture;
		const outputNode = Fn(() => texture(canvasTexture, uv()));
		this.material = new MeshBasicNodeMaterial({ colorNode: outputNode() });
		this.drawingContext = new DrawingContext(
			ctx,
			canvasTexture,
			width,
			height
		);
		setDrawingContext(this.drawingContext);

		const baseMaterial = {
			material: this.material,
			draw: () => {},
			resize: (w: number, h: number) =>
				handleCanvasResize(
					w,
					h,
					canvasTexture,
					this.material,
					outputNode
				)
		};
		this.scene2D = Scene2D(parentNode, width, height, baseMaterial, true);
	}

	draw(callback: () => void) {
		const wrappedCallback = () => {
			this.drawingContext.resetOverlay();
			callback();
			const overlay = this.drawingContext.getCurrentOverlay();
			if (overlay) {
				this.material.colorNode = mix(
					vec4(overlay, 1.0),
					texture(this.canvasTexture, uv()),
					0.5
				);
			} else {
				this.material.colorNode = texture(this.canvasTexture, uv());
			}
			this.material.needsUpdate = true;
		};
		this.scene2D.onDrawScene(wrappedCallback);
	}

	resize(w: number, h: number) {
		this.scene2D.onResize(w, h);
	}
}
