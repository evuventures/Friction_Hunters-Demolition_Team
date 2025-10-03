
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeChange,
  EdgeChange,
  Connection,
  MarkerType,
  useReactFlow,
} from 'reactflow';

import type { FlowchartData, FlowchartNode } from './types';
import InputPanel from './components/InputPanel';
import EditPanel from './components/EditPanel';
import CustomNode from './components/CustomNode';
import Controls from './components/Controls';
import { generateFlowchart } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node<FlowchartNode>[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 5 },
    data: { label: 'Welcome to AI Flowchart Architect!' },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 100, y: 150 },
    data: { label: 'Enter a description, upload a document, or an image of a flowchart in the panel on the left.' },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 400, y: 150 },
    data: { label: 'Click "Generate" and watch the AI build your diagram.' },
  },
];

const initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    { id: 'e1-3', source: '1', target: '3', type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
];


export default function App() {
  const [nodes, setNodes] = useState<Node<FlowchartNode>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node<FlowchartNode> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fitView } = useReactFlow();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (nodes.length > 0) {
      // Fit view to the new nodes after a generation
      setTimeout(() => fitView({ duration: 400, padding: 0.1 }), 100);
    }
  }, [nodes, fitView]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  const handleGenerate = async (text: string, file: File | null) => {
    setIsLoading(true);
    setError(null);
    setSelectedNode(null);

    try {
      let imageBase64: string | null = null;
      let mimeType: string | null = null;

      if (file) {
        const { base64, type } = await fileToBase64(file);
        imageBase64 = base64;
        mimeType = type;
      }
      
      const flowchartData: FlowchartData = await generateFlowchart(text, imageBase64, mimeType);
      
      if (flowchartData.nodes.length === 0) {
          throw new Error("The AI returned an empty flowchart. Please try refining your prompt.");
      }

      const newNodes: Node<FlowchartNode>[] = flowchartData.nodes.map(node => ({
        ...node,
        type: 'custom' // Ensure all nodes from AI use our custom component
      }));
      
      const newEdges: Edge[] = flowchartData.edges.map(edge => ({
        ...edge,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed }
      }));

      setNodes(newNodes);
      setEdges(newEdges);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setNodes(initialNodes);
      setEdges(initialEdges);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNode(null);
    setError(null);
    setTimeout(() => fitView({ duration: 400, padding: 0.1 }), 100);
  };
  
  const handleCenterView = () => {
    fitView({ duration: 500, padding: 0.1 });
  };
  
  const handleDownload = () => {
    const flowchartData = { nodes, edges };
    const jsonString = JSON.stringify(flowchartData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onNodeClick = (_: React.MouseEvent, node: Node<FlowchartNode>) => {
    setSelectedNode(node);
  };
  
  const onPaneClick = () => {
    setSelectedNode(null);
  };
  
  const updateNodeLabel = (nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, label: newLabel } };
        }
        return node;
      })
    );
    // Also update the selected node state if it's the one being edited
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label: newLabel } } : null);
    }
  };

  return (
    <div className="w-screen h-screen flex bg-gray-900 text-white font-sans">
      <InputPanel onGenerate={handleGenerate} isLoading={isLoading} />
      <main className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-800"
        >
          <BgDots />
        </ReactFlow>
        <Controls onReset={handleReset} onCenter={handleCenterView} onDownload={handleDownload} />
        {error && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500/80 text-white p-3 rounded-lg shadow-xl backdrop-blur-sm z-10">
                <strong>Error:</strong> {error}
            </div>
        )}
      </main>
      <EditPanel selectedNode={selectedNode} onUpdate={updateNodeLabel} onClose={() => setSelectedNode(null)}/>
    </div>
  );
}

const BgDots = () => (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 pointer-events-none">
        <defs>
            <pattern id="smallGrid" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="rgba(107, 114, 128, 0.2)" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#smallGrid)" />
    </svg>
);
