export * from "./core";
export * from "./color";
export * from "./utils";
export * from "./blur";
export { UniformSlider } from "./components/UniformSlider";
export * from "./noises";
export * from "./filters";
export * from "./text";
export * from "./time";

// Re-export TSL's native shaders for more user-friendly imports
export * from "three/addons/tsl/display/SobelOperatorNode.js";
export * from "three/addons/tsl/display/GaussianBlurNode.js";
export * from "three/addons/tsl/display/hashBlur.js";
export * from "three/addons/tsl/display/TransitionNode.js";
