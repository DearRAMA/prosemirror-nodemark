import { NodeType } from "prosemirror-model";


export interface NodemarkOption {
  nodeType: NodeType;
}

export interface NodemarkState {
  typing: boolean;
  pending: 'Home' | 'End' | null;

}
