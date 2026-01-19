/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { Rule } from "eslint";

const rule: Rule.RuleModule = {
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
				"Import from 'three/webgpu' instead of 'three' for WebGPU support"
		}
	},
	create(context: Rule.RuleContext): Rule.RuleListener {
		return {
			ImportDeclaration(node: any): void {
				// Check if importing from exactly 'three' (not 'three/*')
				if (node.source.value === "three") {
					context.report({
						node: node.source,
						messageId: "preferWebGPU",
						fix(fixer: Rule.RuleFixer): Rule.Fix {
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

export default rule;
