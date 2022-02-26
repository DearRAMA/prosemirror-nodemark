import { NodemarkState } from "./index";
import { Plugin, Selection, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { findFroms, nodeIsInSet, nodeIsInSets, returnTypingFalse, safeResolve } from "./utils";
import { NodeType } from "prosemirror-model";

export function onArrowRight(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.shiftKey || event.altKey || event.ctrlKey) return returnTypingFalse(view, plugin);

  const { selection, doc } = view.state;
  const [currentPos, right1Pos, right2Pos] = findFroms(doc, selection.from, [0, +1, +2]);
  const [currentInNode, right1stInNode, right2ndInNode] = nodeIsInSets(doc, selection.from, [0, +1, +2], nodeType);
  console.debug('nodemark: onArrowRight', `position: from ${selection.from} to ${selection.to}`);
  console.debug('nodemark: onArrowLeft', `currentPos: ${currentPos}, right1Pos: ${right1Pos}, right2Pos: ${right2Pos}`);
  console.debug('nodemark: onArrowRight', `currentInNode: ${currentInNode}, right1stInNode: ${right1stInNode}, right2ndInNode: ${right2ndInNode}`);
  
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
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, right1Pos))).setMeta(plugin, { typing: false });
    view.dispatch(tr);
    return true;
  }

  // else
  return returnTypingFalse(view, plugin);
}

export function onArrowLeft(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.shiftKey || event.altKey || event.ctrlKey) return returnTypingFalse(view, plugin);

  const { selection, doc } = view.state;
  const [currentPos, left1stPos, left2ndPos] = findFroms(doc, selection.from, [0, -1 , -2]);
  const [currentInNode, left1stInNode, left2ndInNode] = nodeIsInSets(doc, selection.from, [0, -1, -2], nodeType);
  console.debug('nodemark: onArrowLeft', `position: from ${selection.from} to ${selection.to}`);
  console.debug('nodemark: onArrowLeft', `currentPos: ${currentPos}, left1stPos: ${left1stPos}, left2ndPos: ${left2ndPos}`);
  console.debug('nodemark: onArrowLeft', `currentInNode: ${currentInNode}, left1stInNode: ${left1stInNode}, left2ndInNode: ${left2ndInNode}`);

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
    const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, left1stPos))).setMeta(plugin, { typing: false });
    view.dispatch(tr);
    return true;
  }
  
  // else
  return returnTypingFalse(view, plugin);
}

export function onBackspace(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType) {
  if (event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) return returnTypingFalse(view, plugin);

  const { selection, doc } = view.state;
  const [currentPos, left1stPos, left2ndPos] = findFroms(doc, selection.from, [0, -1, -2]);
  const [currentInNode, left1stInNode, left2ndInNode] = nodeIsInSets(doc, selection.from, [0, -1, -2], nodeType);
  console.debug('nodemark: onBackspace', `selection.empty ${selection.empty}`);
  console.debug('nodemark: onBackspace', `position: from ${selection.from} to ${selection.to}`);
  console.debug('nodemark: onBackspace', `currentPos: ${currentPos}, left1stPos: ${left1stPos}, left2ndPos: ${left2ndPos}`);
  console.debug('nodemark: onBackspace', `currentInNode: ${currentInNode}, left1stInNode: ${left1stInNode}, left2ndInNode: ${left2ndInNode}`);

  if (selection.empty) {
    if (
      // outside <node>inside</node> |outside  ->  outside <node>inside</node>|outside
      (!currentInNode && !left1stInNode && left2ndInNode)
      // // outside <node>i|nside</node> outside  ->  outside <node>|inside</node> outside
      // || (currentInNode && left1stInNode)
    ) {
      const tr = view.state.tr.delete(left1stPos, currentPos);
      tr.setSelection(new TextSelection(safeResolve(tr.doc, left1stPos)));
      tr.setMeta(plugin, { typing: false });
      view.dispatch(tr);
      return true;
    }
  } else if (
    // outside <node>inside</node>|█████ide  ->  outside <node>inside</node>|ide
    (!currentInNode && left1stInNode) ||
    // outside <node>insi|██</node>█████ide  ->  outside <node>insi|</node>ide
    (currentInNode)
  ) {
    const tr = view.state.tr.delete(selection.from, selection.to);
    tr.setSelection(new TextSelection(safeResolve(tr.doc, selection.from)));
    tr.setMeta(plugin, { typing: false });
    view.dispatch(tr);
    return true;
  }
  
  return returnTypingFalse(view, plugin);
}

export function onHomeEnd(view: EditorView, plugin: Plugin<NodemarkState>, event: KeyboardEvent, nodeType: NodeType, homeEnd: 'Home' | 'End') {
  const tr = view.state.tr.setMeta(plugin, { pending: homeEnd });
  view.dispatch(tr);
}