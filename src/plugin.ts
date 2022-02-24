import { onArrowLeft, onArrowRight, nextTrAndPass } from "./actions";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { NodeType } from "prosemirror-model";
import { nodeIsInSet, safeResolve } from "./utils";

export const KEY = 'Nodemark';
export const PLUGIN_KEY = new PluginKey(KEY);

export interface NodemarkOption {
  nodeType: NodeType;
}

export interface NodemarkState {
  active: boolean;
  next?: boolean;
}

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
          case 'Home':
          case 'End':
          case 'Backspace':
          case 'Delete':
            return nextTrAndPass(view, plugin, event, opts.nodeType);
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

        return false;
      },
      handleTextInput(view, from, to, text) {
        const { active } = plugin.getState(view.state);
        if (!active) return false;

        const { selection } = view.state;
        console.debug('nodemark: props->handleTextInput', `position: from ${selection.from} to ${selection.to}`);
        console.debug('nodemark: props->handleTextInput', `args: from ${from} to ${to}: ${text}`);

        const tr = view.state.tr.insertText(text, selection.from);
        view.dispatch(tr);
        const tr2 = view.composing ?
          view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from), safeResolve(view.state.doc, selection.from+1))) :
          view.state.tr.setSelection(new TextSelection(safeResolve(view.state.doc, selection.from+1), safeResolve(view.state.doc, selection.from+1)));
        view.dispatch(tr2);

        return true;
      }
    },
    state: {
      init: createDefaultState,
      apply(tr, value, oldState, newState) {
        // const { selection, doc } = newState;
        // const { nodeType } = opts;
        // console.log('nodemark: state->apply', `new state selection: from ${selection.from}, to ${selection.to}`);
        
        // if (!selection.empty) return createDefaultState();
        
        // const currentInNode = nodeIsInSet(doc, selection.from, nodeType);
        // const left1stInNode = nodeIsInSet(doc, selection.from-1, nodeType);
        // const right1stInNode = nodeIsInSet(doc, selection.from+1, nodeType);

        // // outside |<node>inside</node> outside
        // if (!currentInNode && right1stInNode) return { active: true };

        // // outside <node>|inside</node> outside
        // if (!left1stInNode && currentInNode) return { active: true };

        // // outside <node>inside|</node> outside
        // if (currentInNode && !right1stInNode) return { active: true };

        // // outside <node>inside</node>| outside
        // if (left1stInNode && !currentInNode) return { active: true };
        
        // // else
        // return { active: false };

        console.debug('nodemark: state->apply: tr', tr);
        const meta = tr.getMeta(plugin);
        const state = plugin.getState(oldState);
        console.debug('nodemark: state->apply', `meta: ${JSON.stringify(meta)}`);
        if (!!meta?.active) return { active: true };
        if (!!meta?.next || !!state.next) return { active: false, next: true };
        else return createDefaultState();
      }
    },
    appendTransaction: (transactions, oldState, newState) => {
      const { next } = plugin.getState(oldState);
      const meta = transactions[0]?.getMeta(plugin);
      console.debug('nodemark: appendTransaction', `plugin.getState(oldState) next: ${next}`);
      console.debug('nodemark: appendTransaction', `transactions[0]?.getMeta(plugin) next: ${meta?.next}`);
      console.debug('nodemark: appendTransaction transaction', transactions);
      if (!next) return null;
      
      const { selection, doc } = newState;
      const { nodeType } = opts;
      const currentInNode = nodeIsInSet(doc, selection.from, nodeType);
      const left1stInNode = nodeIsInSet(doc, selection.from-1, nodeType);
      const right1stInNode = nodeIsInSet(doc, selection.from+1, nodeType);
      console.debug('nodemark: appendTransaction', `position: from ${selection.from} to ${selection.to}`);
      console.debug('nodemark: appendTransaction', `currentInNode: ${currentInNode}, left1stInNode: ${left1stInNode}, right1stInNode: ${right1stInNode}`);

      if (!currentInNode) {
        if (!(left1stInNode !== right1stInNode)) return null;

        /*                                  
        ** outside <node>inside</node>  ->  outside <node>inside</node>|
        ** |                            ->    
        */
        /*                                  
        ** outside|                     ->  outside|<node>inside</node>
        ** <node>inside</node>          ->    
        */
        return newState.tr.setMeta(plugin, { active: true });
      }

      // Home key -> ^<node>|inside</node> outside -> ^|<node>inside</node> outside
      // End  key -> outside <node>inside|</node>$ -> outside <node>inside</node>|$
      const offset = !left1stInNode ? -1 : +1; // !right1stInNode;
      return newState.tr.setSelection(new TextSelection(safeResolve(doc, selection.from+offset))).setMeta(plugin, { active: true });
    }
  });
  return plugin;
};