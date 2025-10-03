
import type { Node, Edge } from 'reactflow';

export interface FlowchartNode {
  label: string;
}

export interface FlowchartData {
  nodes: Node<FlowchartNode>[];
  edges: Edge[];
}
