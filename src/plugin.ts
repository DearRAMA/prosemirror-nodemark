import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { onArrowLeft, onArrowRight } from "./actions";
import { nodeIsInSet, PLUGIN_KEY, returnDeactive, safeResolve } from "./utils";
import { NodemarkState, NodemarkOption } from "./types";


function createDefaultState(): NodemarkState {
  return { active: false };
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
            return onArrowRight(view, plugin, event, opts.nodeType);
          case 'ArrowLeft':
            return onArrowLeft(view, plugin, event, opts.nodeType);
          case 'ArrowUp':
          case 'ArrowDown':
            return returnDeactive(view, plugin);
          default:
            return false;
        }
      },
      handleClick(view, pos, event) {
        const { active } = plugin.getState(view.state);
        const { selection, doc } = view.state;
        const { nodeType } = opts;
        console.debug('nodemark: props->handleClick', `active: ${active}`);
        console.debug('nodemark: props->handleClick', `selection: from ${selection.from} to ${selection.to}`);
        console.debug('nodemark: props->handleClick', `args: pos ${pos}`);
                
        const currentInNode = nodeIsInSet(doc, selection.from, nodeType);
        const left1stInNode = nodeIsInSet(doc, selection.from-1, nodeType);
        const right1stInNode = nodeIsInSet(doc, selection.from+1, nodeType);

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
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos))).setMeta(plugin, { active: true });
          view.dispatch(tr);
          return true;
        }

        // else
        return returnDeactive(view, plugin);
      },
      handleTextInput(view, from, to, text) {
        const { active } = plugin.getState(view.state);
        if (!active) {
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
        view.dispatch(tr2.setMeta(plugin, { active: false }));

        return true;
      }
    },
    state: {
      init: createDefaultState,
      apply(tr, value, oldState, newState) {
        console.debug('nodemark: state->apply: tr', tr);
        const meta = tr.getMeta(plugin);
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