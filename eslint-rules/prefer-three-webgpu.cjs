/**
 * @file Prefer importing from 'three/webgpu' instead of 'three'
 * @type {import("eslint").Rule.RuleModule}
 */

module.exports = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Prefer importing from 'three/webgpu' instead of 'three'",
			category: "Best Practices",
			recommended: false
		},
		fixable: "code",
		schema: [],
		messages: {
			preferWebGPU:
				"Import from 'three/webgpu' instead of 'three' " +
				"for WebGPU support"
		}
	},
	/**
	 * @param {import("eslint").Rule.RuleContext} context
	 * @returns {import("eslint").Rule.RuleListener}
	 */
	create(context) {
		return {
			/** @param {import("estree").ImportDeclaration} node */
			ImportDeclaration(node) {
				// Check if importing from exactly 'three' (not 'three/*')
				if (node.source.value === "three") {
					context.report({
						node: node.source,
						messageId: "preferWebGPU",
						/** @param {import("eslint").Rule.RuleFixer} fixer */
						fix(fixer) {
							// Replace 'three' with 'three/webgpu'
							return fixer.replaceText(
								node.source,
								'"three/webgpu"'
							);
						}
					});
				}
			}
		};
	}
};
