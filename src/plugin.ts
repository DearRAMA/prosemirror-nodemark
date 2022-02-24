import { onArrowLeft, onArrowRight } from "./actions";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { NodeType } from "prosemirror-model";
import { nodeIsInSet, safeResolve } from "./utils";

export const KEY = 'Nodemark';
export const PLUGIN_KEY = new PluginKey(KEY);

export interface NodemarkOption {
  node: NodeType;
}

export interface NodemarkState {
  active: boolean;
  side: number;
  inout: number; // in: 1, out: -1
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
          const state = plugin.getState(view.state) as NodemarkState;
          view.dom.classList[state?.active ? 'add' : 'remove']('nodemark-no-cursor');
        },
      }
    },
    props: {
      decorations: (state) => {
        const { active } = plugin.getState(state) ?? {};
        if (!active) return DecorationSet.empty;
        const deco = Decoration.widget(state.selection.from, toDom, { side: 0 });
        return DecorationSet.create(state.doc, [deco]);        
      },
      handleKeyDown(view, event) {
        switch(event.key) {
          case 'ArrowRight':
            return onArrowRight(view, plugin, event, opts.node);
          case 'ArrowLeft':
            return onArrowLeft(view, plugin, event, opts.node);
          default:
            return false;
        }
      },
      handleTextInput(view, from, to, text) {
        const { selection } = view.state;
        const inNode = nodeIsInSet(view.state.doc, selection.from, opts.node);
        const nextNode = nodeIsInSet(view.state.doc, selection.from+1, opts.node);
        const prevNode = nodeIsInSet(view.state.doc, selection.from-1, opts.node);
        const { active, side } = plugin.getState(view.state);
        if (!active) return false;
        console.log(`position: ${selection.from}`)
        console.log(`from ${from} to ${to}: ${text}`);
        if (side === 1) {
          const tr = view.state.tr.insertText(text, selection.from);
          view.dispatch(tr);
          const tr2 = view.composing ?
            view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from), safeResolve(view.state.doc, selection.from+1))) :
            view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from+1), safeResolve(view.state.doc, selection.from+1)));
          view.dispatch(tr2);
          
          return true;
          // const tr2 = view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from), safeResolve(view.state.doc, selection.from))).insertText(text, selection.from);
          // view.dispatch(tr2);
          // return true;
        }
        if (side === -1) {
          const tr = view.state.tr.insertText(text, selection.from);
          view.dispatch(tr);
          const tr2 = view.composing ? 
            view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from), safeResolve(view.state.doc, selection.from+1))) :
            view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from+1), safeResolve(view.state.doc, selection.from+1)));
          view.dispatch(tr2);
          view.composing && view.dom.dispatchEvent(new CompositionEvent('compositionstart'));
          return true;
        }

        return false;
      }
    },
    state: {
      init: () => ({ active: false, side: 0, inout: 0 }),
      apply(tr, value, oldState, newState) {
        const meta = tr.getMeta(plugin);
        if (meta) return meta;
        else return { active: false, side: 0, inout: 0 };
      }
    },
    appendTransaction: (transactions, oldState, newState) => {
      return null;
    }
  });
  return plugin;
};