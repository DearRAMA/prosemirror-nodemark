import { Node, NodeType, ResolvedPos } from "prosemirror-model";
import { EditorView } from "prosemirror-view";

export function safeResolve(doc: Node, pos: number) {
  return doc.resolve(Math.min(Math.max(1, pos), doc.nodeSize - 2));
}

export function nodeIsInSet(doc: Node, pos: number, nodeType: NodeType) {
  const resolvedPos = safeResolve(doc, pos);
  for (let i=resolvedPos.depth; i>=0 ; --i) {
    if (nodeType === resolvedPos.node(i).type) return true;
  }
  return false;
}