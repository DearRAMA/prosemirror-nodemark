import { NodemarkState } from "./index";
import { Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { nodeIsInSet, safeResolve } from "./utils";
import { NodeType } from "prosemirror-model";

export function onArrowRight(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.shiftKey || event.altKey || event.ctrlKey) return false;
  if (view.composing) return false;

  const { selection, doc } = view.state;
  const { active } = plugin.getState(view.state);
  const currentInNode = nodeIsInSet(doc, selection.from, nodeType);
  const right1stInNode = nodeIsInSet(doc, selection.from+1, nodeType);
  const right2ndInNode = nodeIsInSet(doc, selection.from+2, nodeType);
  console.debug('nodemark: onArrowRight', `position: from ${selection.from} to ${selection.to}`);
  console.debug('nodemark: onArrowRight', `currentInNode: ${currentInNode}, right1stInNode: ${right1stInNode}, right2ndInNode: ${right2ndInNode}`);

  // outside <node>inside</node>$
  if (active && selection.from === doc.nodeSize-3) return true;
  if (
    // outside| <node>inside</node> outside  ->  outside |<node>inside</node> outside
    (!currentInNode && !right1stInNode && right2ndInNode) ||
    
    // outside |<node>inside</node> outside  ->  outside <node>|inside</node> outside
    (!currentInNode && right1stInNode) ||
    
    // outside <node>insid|e</node> outside  ->  outside <node>inside|</node> outside
    (currentInNode && right1stInNode && !right2ndInNode) ||
    
    // outside <node>inside|</node> outside  ->  outside <node>inside</node>| outside
    (currentInNode && !right1stInNode)
  ) {
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, selection.from+1))).setMeta(plugin, { active: true });
    view.dispatch(tr);
    return true;
  }

  // else
  return false;
}

export function onArrowLeft(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.shiftKey || event.altKey || event.ctrlKey) return false;
  if (view.composing) return false;

  const { selection, doc } = view.state;
  const { active } = plugin.getState(view.state);
  const currentInNode = nodeIsInSet(doc, selection.from, nodeType);
  const left1stInNode = nodeIsInSet(doc, selection.from-1, nodeType);
  const left2ndInNode = nodeIsInSet(doc, selection.from-2, nodeType);
  console.debug('nodemark: onArrowLeft', `position: from ${selection.from} to ${selection.to}`);
  console.debug('nodemark: onArrowLeft', `currentInNode: ${currentInNode}, left1stInNode: ${left1stInNode}, left2ndInNode: ${left2ndInNode}`);

  // ^|<node>inside</node> outside
  if (active && selection.from === 1) return true;
  if (
    // outside <node>inside</node> |outside  ->  outside <node>inside</node>| outside
    (!currentInNode && !left1stInNode && left2ndInNode) ||

    // outside <node>inside</node>| outside  ->  outside <node>inside|</node> outside
    (!currentInNode && left1stInNode) ||

    // outside <node>i|nside</node> outside  ->  outside <node>|inside</node> outside
    (currentInNode && left1stInNode && !left2ndInNode) ||

    // outside <node>|inside</node> outside  ->  outside |<node>inside</node> outside
    (currentInNode && !left1stInNode)
  ) {
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, selection.from-1))).setMeta(plugin, { active: true });
    view.dispatch(tr);
    return true;
  }
  
  // else
  return false;
}

export function nextTrAndPass(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.shiftKey || event.altKey || event.ctrlKey) return false;

  const tr = view.state.tr.setMeta(plugin, { next: true });
  view.dispatch(tr);
  return false;
}