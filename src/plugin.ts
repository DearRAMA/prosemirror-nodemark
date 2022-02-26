import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { onArrowLeft, onArrowRight, onBackspace, onHomeEnd } from "./actions";
import { findFroms, isActive, nodeIsInSet, PLUGIN_KEY, returnTypingFalse, safeResolve } from "./utils";
import { NodemarkState, NodemarkOption } from "./types";


function createDefaultState(): NodemarkState {
  return { 
    typing: false,
    pending: null,
  };
}

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
            return onHomeEnd(view, plugin, event, opts.nodeType, 'Home');
          case 'End':
            return onHomeEnd(view, plugin, event, opts.nodeType, 'End');
          default:
            return false;
        }
      },
      handleClick(view, pos, event) {
        const { selection, doc } = view.state;
        console.debug('nodemark: props->handleClick', `selection: from ${selection.from} to ${selection.to}`);
        console.debug('nodemark: props->handleClick', `args: pos ${pos}`);
                
        const active = isActive(view.state, opts.nodeType);

        if (active) {
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos))).setMeta(plugin, { typing: false });
          view.dispatch(tr);
          return true;
        }

        // else
        return returnTypingFalse(view, plugin);
      },
      handleTextInput(view, from, to, text) {
        const active = isActive(view.state, opts.nodeType);
        console.debug('nodemark handleTextInput', `active ${active}`);
        if (!active) {
          return false;
        }
        const { typing } = plugin.getState(view.state);
        console.debug('nodemark handleTextInput', `typing ${active}`);
        if (typing) {
          return false;
        }

        const { selection } = view.state;
        console.debug('nodemark: props->handleTextInput', `position: from ${selection.from} to ${selection.to}`);
        console.debug('nodemark: props->handleTextInput', `args: from ${from} to ${to}: ${text}`);

        const tr = view.state.tr.insertText(text, selection.from);
        view.dispatch(tr);
        const tr2 = view.composing ?
          view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from), safeResolve(view.state.doc, selection.from+1))) :
          view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from+1), safeResolve(view.state.doc, selection.from+1)));
        tr2.setMeta(plugin, { typing: true });
        view.dispatch(tr2);

        return true;
      }
    },
    state: {
      init: createDefaultState,
      apply(tr, value, oldState, newState) {
        console.debug('nodemark: state->apply: tr', tr);
        const meta = tr.getMeta(plugin);
        const oldPluginState = plugin.getState(oldState);
        console.debug('nodemark: state->apply', `meta: ${meta ? JSON.stringify(meta) : 'undefiend'}`);
        console.debug('nodemark: state->apply', `oldPluginState: ${JSON.stringify(oldPluginState)}`);
        return {...oldPluginState, ...(meta ? { pending: null, ...meta } : {})};
      }
    },
    appendTransaction: (transactions, oldState, newState) => {
      console.debug('nodemark: appendTransaction transaction', transactions);
      console.debug('nodemark: appendTransaction oldState', oldState);
      console.debug('nodemark: appendTransaction newState', newState);

      const oldPluginState = plugin.getState(oldState);
      const { selection: oldSelection } = oldState;
      const { selection: newSelection } = newState;
      const { pending = null } = oldPluginState;
      if (
        (pending === 'Home' || pending === 'End') &&
        !oldSelection.eq(newSelection) &&
        (pending === 'Home' ? oldSelection.from >= newSelection.from : oldSelection.from <= newSelection.from)
      ) {
        const tr = newState.tr;

        const currentPos = pending === 'Home' ? newSelection.from : newSelection.to;
        const [left1stPos, right1stPos] = findFroms(newState.doc, currentPos, [-1, +1]);
        const currentInNode = nodeIsInSet(newState.doc, currentPos, opts.nodeType);
        if (currentInNode) {
          if (newSelection.empty) {
            tr.setSelection(new TextSelection(
              pending === 'Home'? safeResolve(newState.doc, left1stPos) : safeResolve(newState.doc, right1stPos),
              pending === 'Home'? safeResolve(newState.doc, left1stPos) : safeResolve(newState.doc, right1stPos)
            ));
          }
          else {
            tr.setSelection(new TextSelection(
              pending === 'Home'? safeResolve(newState.doc, left1stPos) : newSelection.$from,
              pending === 'Home'? newSelection.$to : safeResolve(newState.doc, right1stPos)
            ));
          }
          
        }
        return tr.setMeta(plugin, { pending: null });
      }
      return null;
    }
  });
  return plugin;
};