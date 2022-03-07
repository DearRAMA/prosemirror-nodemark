import { Node, NodeType } from "prosemirror-model";
import { EditorState, Plugin, PluginKey, Selection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { NodemarkState } from "./types";


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

export function createDefaultState(): NodemarkState {
  return {
    samePos: false,
  };
}

export function returnTypingFalse(view: EditorView, plugin: Plugin) {
  view.state.tr.setMeta(plugin, createDefaultState());
  return false;
}

/** @deprecated */
export function isActive(state: EditorState, nodeType: NodeType, pos: number | null = null) {
  return checkActive(state, nodeType, pos).isActive;
}

export function checkActive(state: EditorState, nodeType: NodeType, pos: number | null = null): {
  isActive: boolean,
  /**
   * -2: outside |&lt;node&gt;inside&lt;/node&gt; outside
   * 
   * -1: outside &lt;node&gt;|inside&lt;/node&gt; outside
   * 
   * +1: outside &lt;node&gt;inside|&lt;/node&gt; outside
   * 
   * +2: outside &lt;node&gt;inside&lt;/node&gt;| outside
   * 
   *  0: false
   * 
   * 10 (010): &lt;node&gt;inside&lt;/node&gt;|&lt;node&gt;inside&lt;/node&gt; 
   */
  activePos: -2 | -1 | 0 | 1 | 2 | 10
} {

  const { selection, doc } = state;

  const from = pos === null ? selection.from : pos;
  const to = pos === null ? selection.to : pos;

  console.debug('nodemark', 'checkActive', `selection from ${from} to ${to}`);
  if (from !== to) return { isActive: false, activePos: 0 };

  const [currentPos, left1stPos, right1Pos] = findFroms(doc, from, [0, -1, +1]);
  const [currentInNode, left1stInNode, right1stInNode] = nodeIsInSets(doc, from, [0, -1, +1], nodeType);
  console.debug('nodemark', 'checkActive', `currentPos ${currentPos}, left1stPos ${left1stPos}, right1Pos ${right1Pos}`);
  console.debug('nodemark', 'checkActive', `currentInNode ${currentInNode}, left1stInNode ${left1stInNode}, right1stInNode ${right1stInNode}`);

  // <node>inside</node>|<node>inside</node>
  if (!currentInNode && right1stInNode && left1stInNode) {
    return { isActive: true, activePos: 10 };
  }
  // outside |<node>inside</node> outside
  if (!currentInNode && right1stInNode) {
    return { isActive: true, activePos: -2 };
  }
  // outside <node>|inside</node> outside
  if (!left1stInNode && currentInNode) {
    return { isActive: true, activePos: -1 };
  }
  // outside <node>inside|</node> outside
  if (currentInNode && !right1stInNode) {
    return { isActive: true, activePos: 1 };
  }
  // outside <node>inside</node>| outside
  if (left1stInNode && !currentInNode) {
    return { isActive: true, activePos: 2 };
  }

  return { isActive: false, activePos: 0 };
}