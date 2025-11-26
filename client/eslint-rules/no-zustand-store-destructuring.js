/**
 * ESLint rule to prevent object destructuring with Zustand store hooks.
 *
 * This rule enforces the use of selector functions to prevent unnecessary re-renders
 * when using Zustand stores. Instead of:
 *   const { property } = useStore()
 *
 * Use:
 *   const property = useStore((state) => state.property)
 *
 * Configuration:
 *   - hookPattern: Regex pattern to match Zustand store hook names (default: /^use.*Store$/)
 *   - hookNames: Array of specific hook names to check (optional)
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent object destructuring with Zustand store hooks',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          hookPattern: {
            type: 'string',
            description: 'Regex pattern to match Zustand store hook names',
          },
          hookNames: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of specific hook names to check',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDestructuring:
        'Do not use object destructuring with Zustand store hooks. Use a selector function instead: {{hookName}}((state) => state.property)',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const hookPattern = options.hookPattern ? new RegExp(options.hookPattern) : /^use.*Store$/;
    const hookNames = options.hookNames || [];

    /**
     * Check if a hook name matches the Zustand store pattern
     */
    function isZustandStoreHook(hookName) {
      // Check against specific hook names first
      if (hookNames.includes(hookName)) {
        return true;
      }
      // Check against pattern
      return hookPattern.test(hookName);
    }

    /**
     * Get the hook name from a call expression
     */
    function getHookName(callExpression) {
      // Direct identifier call: useStore()
      if (callExpression.callee.type === 'Identifier') {
        return callExpression.callee.name;
      }

      // Member expression: something.useStore()
      if (callExpression.callee.type === 'MemberExpression') {
        const memberExpression = callExpression.callee;
        if (memberExpression.property && memberExpression.property.type === 'Identifier') {
          return memberExpression.property.name;
        }
      }

      return null;
    }

    /**
     * Check if a call expression is a Zustand store hook
     */
    function isZustandStoreCall(callExpression) {
      const hookName = getHookName(callExpression);
      return hookName ? isZustandStoreHook(hookName) : false;
    }

    /**
     * Check if the call has a selector function as the first argument
     */
    function hasSelectorFunction(callExpression) {
      if (callExpression.arguments.length === 0) {
        return false;
      }

      const firstArg = callExpression.arguments[0];
      return firstArg.type === 'ArrowFunctionExpression' || firstArg.type === 'FunctionExpression';
    }

    return {
      VariableDeclarator(node) {
        // Check if the initializer is a call expression
        if (!node.init || node.init.type !== 'CallExpression') {
          return;
        }

        const callExpression = node.init;

        // Check if this is a Zustand store hook call
        if (!isZustandStoreCall(callExpression)) {
          return;
        }

        // Check if the result is being destructured
        if (node.id.type === 'ObjectPattern') {
          // If there's no selector function, this is an error
          if (!hasSelectorFunction(callExpression)) {
            const hookName = getHookName(callExpression);
            context.report({
              node: node.id,
              messageId: 'noDestructuring',
              data: {
                hookName: hookName || 'useStore',
              },
            });
          }
        }
      },
    };
  },
};
