import { AttributeSpec, NodeSpec } from "prosemirror-model";

export const FlavorNode: NodeSpec = {
  group: "inline",
  inline: true,

  attrs: {
    code: {},
    name: {},
  },

  content: "text*",
  // content: "block+",

  // selectable: false,
  // draggable: false,

  toDOM: (node) => {
    return [
      "span",
      {
        "data-flavor-code": node.attrs.code,
        "data-flavor-name": node.attrs.name,
        class: "prosemirror-mention-node",
      },
      0,
    ]
  },

  selectable: true,
  draggable: true,

  parseDOM: [
    {
      tag: "span[data-flavor-code][data-flavor-name]",

      getAttrs: (dom) => {
        if (typeof dom === "string" || dom.nodeType !== Node.ELEMENT_NODE)
          return {};
        const element = dom as Element;
        var code = element.getAttribute("data-flavor-code");
        var name = element.getAttribute("data-flavor-name");
        return {
          code: code,
          name: name,
        };
      }
    }
  ],
};