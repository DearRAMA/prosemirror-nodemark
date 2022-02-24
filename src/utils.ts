import { Node, NodeType } from "prosemirror-model";
import { PluginKey } from "prosemirror-state";


export const DEFAULT_KEY = 'nodemark';
export const PLUGIN_KEY = new PluginKey(DEFAULT_KEY);

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