import { NodemarkState } from "./index";
import { Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { nodeIsInSet, safeResolve } from "./utils";
import { NodeType } from "prosemirror-model";

export function onArrowRight(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  const { selection, doc } = view.state;

  const pos = selection.$from;
  const inNode = !!nodeIsInSet(doc, selection.from, nodeType);
  const nextNode = !!nodeIsInSet(doc, selection.from+1, nodeType);
  console.debug(`inNode: ${inNode}, nextNode: ${nextNode}`);
  
  // <node>inside|</node> outside -> <node>inside</node>| outside
  if (inNode && !nextNode) {
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from+1))).setMeta(plugin, { active: true, side: +1, inout: -1 });
    view.dispatch(tr);
    return true;
  }
  return false;
}

export function onArrowLeft(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  const { selection, doc } = view.state;

  const inNode = !!nodeIsInSet(doc, selection.from, nodeType);
  const prevNode = !!nodeIsInSet(doc, selection.from-1, nodeType);
  const pprevNode = !!nodeIsInSet(doc, selection.from-2, nodeType);
  console.debug('onArrowLeft', `position: ${selection.from}`);
  console.debug('onArrowLeft', `prevNode: ${prevNode}, pprevNode: ${pprevNode}`);

  if (prevNode && !pprevNode) {
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from-1))).setMeta(plugin, { active: true, side: -1, inout: +1 });
    view.dispatch(tr);
    return true;
  }
  if (inNode && !prevNode) {
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from-1))).setMeta(plugin, { active: true, side: -1, inout: -1 });
    view.dispatch(tr);
    return true;
  }

  return false;
}