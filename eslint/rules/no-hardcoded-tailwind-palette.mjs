const DISALLOWED_TAILWIND_COLOR_PATTERN =
  /\b(?:[\w-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|placeholder|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b|\b(?:[\w-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke|placeholder|decoration)-(?:white|black)\b/g;

const CLASSNAME_HELPERS = new Set(["cn", "cva", "clsx", "twMerge"]);

function isClassnameContext(node) {
  let current = node.parent;

  while (current) {
    if (
      current.type === "JSXAttribute" &&
      current.name?.type === "JSXIdentifier" &&
      current.name.name === "className"
    ) {
      return true;
    }

    if (current.type === "CallExpression") {
      if (
        current.callee.type === "Identifier" &&
        CLASSNAME_HELPERS.has(current.callee.name)
      ) {
        return true;
      }

      if (
        current.callee.type === "MemberExpression" &&
        current.callee.property.type === "Identifier" &&
        CLASSNAME_HELPERS.has(current.callee.property.name)
      ) {
        return true;
      }
    }

    current = current.parent;
  }

  return false;
}

function reportMatch(context, node, source) {
  DISALLOWED_TAILWIND_COLOR_PATTERN.lastIndex = 0;
  const match = DISALLOWED_TAILWIND_COLOR_PATTERN.exec(source);
  if (!match) return;

  context.report({
    node,
    message:
      'Avoid hardcoded Tailwind palette class "{{token}}". Use semantic design-system tokens/primitives instead.',
    data: {
      token: match[0],
    },
  });
}

const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow hardcoded Tailwind palette classes in className and class helper calls.",
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!isClassnameContext(node)) return;
        reportMatch(context, node, node.value);
      },
      TemplateElement(node) {
        if (!isClassnameContext(node)) return;
        const value = node.value.cooked ?? "";
        reportMatch(context, node, value);
      },
    };
  },
};

export default rule;
