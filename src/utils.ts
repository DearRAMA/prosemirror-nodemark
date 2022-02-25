import { Node, NodeType } from "prosemirror-model";
import { EditorState, Plugin, PluginKey, Selection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";


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

export function findFroms(doc: Node, refPos: number, offsets: number[]) {
  const solvedPos = new Map<number, number>([[0, refPos]]);
  function getFindFrom(offset: number): number {
    if (solvedPos.has(offset)) return solvedPos.get(offset) as number;

    const prevOffset = offset > 0 ? offset-1 : offset+1;
    const prevFindFrom = getFindFrom(prevOffset);
    const dir = offset > 0 ? +1 : -1;
    const resolved = safeResolve(doc, prevFindFrom+dir);
    const pos = Selection.findFrom(resolved, dir)?.from ?? prevFindFrom+dir;
    solvedPos.set(offset, pos);
    return pos;
  }
  return offsets.map(getFindFrom);
}

export function nodeIsInSets(doc: Node, refPos: number, offsets: number[], nodeType: NodeType) {
  return findFroms(doc, refPos, offsets).map((pos) => nodeIsInSet(doc, pos, nodeType));
}

export function returnTypingFalse(view: EditorView, plugin: Plugin) {
  view.state.tr.setMeta(plugin, { typing: false });
  return false;
}

export function isActive(state: EditorState, nodeType: NodeType) {
  
  const { selection, doc } = state;
  console.debug('nodemark isActive', `selection from ${selection.from} to ${selection.to}`);
  if (selection.from !== selection.to) return false;

  const [currentPos, left1stPos, right1Pos] = findFroms(doc, selection.from, [0, -1, +1]);
  const [currentInNode, left1stInNode, right1stInNode] = nodeIsInSets(doc, selection.from, [0, -1, +1], nodeType);
  console.debug('nodemark isActive', `currentPos ${currentPos}, left1stPos ${left1stPos}, right1Pos ${right1Pos}`);
  console.debug('nodemark isActive', `currentInNode ${currentInNode}, left1stInNode ${left1stInNode}, right1stInNode ${right1stInNode}`);

  if (
    // outside |<node>inside</node> outside
    (!currentInNode && right1stInNode) ||
    // outside <node>|inside</node> outside
    (!left1stInNode && currentInNode) ||
    // outside <node>inside|</node> outside
    (currentInNode && !right1stInNode) || 
    // outside <node>inside</node>| outside
    (left1stInNode && !currentInNode)
  ) {
    return true;
  } else {
    return false;
  }
}