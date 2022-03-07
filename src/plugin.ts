import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { onArrowLeft, onArrowRight, onBackspace, onEnd, onHome } from "./actions";
import { checkActive, createDefaultState, findFroms, isActive, nodeIsInSet, nodeIsInSets, PLUGIN_KEY, returnTypingFalse, safeResolve } from "./utils";
import { NodemarkState, NodemarkOption } from "./types";


function toDom(): Node {
  const span = document.createElement('span');
  span.classList.add('nodemark-fake-cursor');
  return span;
}

export function getNodemarkPlugin(opts: NodemarkOption) {
  const plugin: Plugin<NodemarkState> = new Plugin<NodemarkState>({
    key: PLUGIN_KEY,
    view() {
      return {
        update: (view) => {
          const active = isActive(view.state, opts.nodeType);
          view.dom.classList[active ? 'add' : 'remove']('nodemark-no-cursor');
        },
      }
    },
    props: {
      decorations: (state) => {
        const active = isActive(state, opts.nodeType);
        if (!active) return DecorationSet.empty;
        const deco = Decoration.widget(state.selection.from, toDom, { side: 0 });
        return DecorationSet.create(state.doc, [deco]);        
      },
      handleKeyDown(view, event) {
        switch(event.key) {
          case 'ArrowRight':
            return onArrowRight(view, plugin, event, opts.nodeType);
          case 'ArrowLeft':
            return onArrowLeft(view, plugin, event, opts.nodeType);
          case 'ArrowUp':
          case 'ArrowDown':
            return returnTypingFalse(view, plugin);
          case 'Backspace':
            return onBackspace(view, plugin, event, opts.nodeType);
          case 'Delete':
            return returnTypingFalse(view, plugin);
          case 'Home':
            return onHome(view, plugin, event, opts.nodeType);
          case 'End':
            return onEnd(view, plugin, event, opts.nodeType);
          default:
            return false;
        }
      },
      handleClick(view, pos, event) {
        const { selection, doc } = view.state;
        console.debug('nodemark: props->handleClick', `selection: from ${selection.from} to ${selection.to}`);
        console.debug('nodemark: props->handleClick', `args: pos ${pos}`);
        
        const active = isActive(view.state, opts.nodeType, pos);
        const [left1stInNode, currentInNode, right2ndInNode] = [-1, 0, +2].map(offset => nodeIsInSet(doc, pos+offset, opts.nodeType));

        if (active) {
          // when click empty node
          // outside <node>|</node> outside -> outside <node></node>| outside, not outside <node>|</node> outside
          // click twice same position
          if (
            !currentInNode && left1stInNode && 
            selection.from === pos && 
            safeResolve(doc, pos-1).node().nodeSize === 2 && 
            !plugin.getState(view.state).samePos
          ) {
            const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos-1))).setMeta(plugin, { ...createDefaultState(), samePos: true });
            view.dispatch(tr);
            return true;
          }
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos))).setMeta(plugin, createDefaultState());
          view.dispatch(tr);
          return true;
        }

        // click |<p><node>inside</node> outside -> pos == |<p><node>inside</node> outside, not <p>|<node>inside</node> outside
        // check except outside| <node>inside</node> outside -> outside |<node>inside</node> outside
        if (!currentInNode && right2ndInNode && !(view.domAtPos(selection.from).node instanceof Text)) {
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos+1))).setMeta(plugin, createDefaultState());
          view.dispatch(tr);
          return true;
        }

        // else
        return returnTypingFalse(view, plugin);
      },
      handleDOMEvents: {
        beforeinput(view, event) {
          const { isActive, activePos } = checkActive(view.state, opts.nodeType);
          const { selection } = view.state;
          const { node: domAtPosLeft } = view.domAtPos(selection.from, -1);
          const actualSelectionDom = document.getSelection()?.anchorNode;
          
          if (!isActive ||
            !(
              (activePos === -2 && domAtPosLeft !== actualSelectionDom) ||
              (activePos === -1) ||
              (activePos === +1 && domAtPosLeft !== actualSelectionDom) ||
              (activePos === +2)
            )
          ) return false;
          
          // RPRS-19 only space is not inserted correct position. so override browser behaviour
          if (event.data === ' ') {
            const tr = view.state.tr.insertText(' ', selection.from, selection.to);
            tr.setSelection(new TextSelection(safeResolve(tr.doc, selection.from+1)));
            tr.setMeta(plugin, { ...createDefaultState() });
            view.dispatch(tr);
            event.preventDefault();
            return true;
          }
          const tr = view.state.tr.insertText('\u200b', selection.from, selection.to);
          tr.setSelection(new TextSelection(safeResolve(tr.doc, selection.from), safeResolve(tr.doc, selection.from+1)));
          tr.setMeta(plugin, { ...createDefaultState() });
          view.dispatch(tr);
          return false;
        }
      }
    },
    state: {
      init: createDefaultState,
      apply(tr, value, oldState, newState) {
        console.debug('nodemark: state->apply: tr', tr);
        const meta = tr.getMeta(plugin) ?? {};
        const oldPluginState = plugin.getState(oldState);
        console.debug('nodemark: state->apply', `meta: ${JSON.stringify(meta)}`);
        console.debug('nodemark: state->apply', `oldPluginState: ${JSON.stringify(oldPluginState)}`);
        return {...oldPluginState, ...meta};
      }
    },
    appendTransaction: (transactions, oldState, newState) => {
      console.debug('nodemark: appendTransaction', transactions);
      return null;
    }
  });
  return plugin;
};