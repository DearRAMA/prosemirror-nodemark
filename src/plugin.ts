import { Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { onArrowLeft, onArrowRight, onBackspace, onEnd, onHome } from "./actions";
import { findFroms, isActive, nodeIsInSet, nodeIsInSets, PLUGIN_KEY, returnTypingFalse, safeResolve } from "./utils";
import { NodemarkState, NodemarkOption } from "./types";


function createDefaultState(): NodemarkState {
  return { typing: false };
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
        
        // click |<p><node>inside</node> outside -> pos == |<p><node>inside</node> outside, not <p>|<node>inside</node> outside
        const active = isActive(view.state, opts.nodeType, pos);

        if (active) {
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, pos))).setMeta(plugin, { typing: false });
          view.dispatch(tr);
          return true;
        }

        const [right1Pos] = findFroms(doc, pos, [+1]);
        const [currentInNode, right2ndInNode] = nodeIsInSets(doc, pos, [0, +2], opts.nodeType);
        if (!currentInNode && right2ndInNode) {
          const tr = view.state.tr.setSelection(new TextSelection(safeResolve(doc, right1Pos))).setMeta(plugin, { typing: false });
          view.dispatch(tr);
          return true;
        }

        // else
        return returnTypingFalse(view, plugin);
      },
      handleDOMEvents: {
        beforeinput(view, event) {
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
          const tr = view.state.tr.insertText('\u200b', selection.from, selection.to);
          tr.setSelection(new TextSelection(safeResolve(tr.doc, selection.from), safeResolve(tr.doc, selection.from+1)));
          tr.setMeta(plugin, { typing: true });
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