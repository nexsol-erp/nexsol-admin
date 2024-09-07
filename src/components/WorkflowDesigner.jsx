import React, { useState, useCallback } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Handle,
} from "react-flow-renderer";
import "../styles/WorkflowDesigner.css";

// Custom Node for User Stage (Person Icon)
const UserStageNode = ({ data }) => {
  return (
    <div>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Simple person icon */}
        <circle cx="50" cy="30" r="15" fill="#007bff" /> {/* Head */}
        <rect x="35" y="50" width="30" height="40" fill="#007bff" />{" "}
        {/* Body */}
        <text x="50%" y="90%" fill="white" fontSize="14" textAnchor="middle">
          {data.label}
        </text>
      </svg>
      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
    </div>
  );
};

// Custom Node for Condition (Octagon)
const ConditionNode = ({ data }) => {
  return (
    <div>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <polygon
          points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30"
          style={{ fill: "#d32f2f", stroke: "black", strokeWidth: 1 }}
        />
        <text x="50%" y="55%" fill="white" fontSize="14" textAnchor="middle">
          {data.label}
        </text>
      </svg>
      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
    </div>
  );
};

// Custom Node for Stop Stage (Small Red Circle)
const StopStageNode = ({ data }) => {
  return (
    <div>
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" fill="red" /> {/* Red Circle */}
        <text x="50%" y="55%" fill="white" fontSize="14" textAnchor="middle">
          {data.label}
        </text>
      </svg>
      <Handle type="target" position="top" />
      <Handle type="source" position="bottom" />
    </div>
  );
};

// Custom Node for Start Stage (Green Circle)
const StartStageNode = ({ data }) => {
  return (
    <div>
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" fill="green" /> {/* Green Circle */}
        <text x="50%" y="55%" fill="white" fontSize="14" textAnchor="middle">
          {data.label}
        </text>
      </svg>
      <Handle type="source" position="bottom" />
    </div>
  );
};

// Initial Nodes with Start Node as the default
const initialNodes = [
  {
    id: "1",
    type: "startStage", // Default Start Node type (Green Circle)
    data: { label: "Start", properties: [] },
    position: { x: 250, y: 5 },
  },
];

const initialEdges = [];

const nodeTypes = {
  startStage: StartStageNode, // Register custom Start Stage (green circle)
  condition: ConditionNode, // Register custom Condition (octagon)
  userStage: UserStageNode, // Register custom User Stage (user icon)
  stopStage: StopStageNode, // Register custom Stop Stage (red circle)
};

const WorkflowDesigner = () => {
  // State management for nodes, edges, and selection
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedElement, setSelectedElement] = useState(null); // For tracking selected node or edge
  const [newPropertyKey, setNewPropertyKey] = useState(""); // For new property key
  const [newPropertyValue, setNewPropertyValue] = useState(""); // For new property value
  const [edgeType, setEdgeType] = useState(null); // To track edge type ("yes" or "no")

  // Function to handle adding a new edge (link) between nodes
  const onConnect = useCallback(
    (params) => {
      let newEdge = {
        ...params,
        animated: true,
        data: { properties: [] }, // Initialize data field with properties array
      };

      if (edgeType === "yes") {
        newEdge = {
          ...newEdge,
          style: { stroke: "green", strokeWidth: 4 }, // Green thick line for Yes
          label: "Yes",
        };
      } else if (edgeType === "no") {
        newEdge = {
          ...newEdge,
          style: { stroke: "red", strokeWidth: 4 }, // Red thick line for No
          label: "No",
        };
      } else {
        newEdge = {
          ...newEdge,
          style: { strokeWidth: 2 }, // Normal connector
          label: "Next", // Default label for normal connectors
        };
      }

      setEdges((eds) => addEdge(newEdge, eds));
      setEdgeType(null); // Reset edge type after use
    },
    [setEdges, edgeType]
  );

  // Function to add a new node
  const addNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      data: { label: `Node ${nodes.length + 1}`, properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Function to add a conditional node (octagon-shaped)
  const addConditionalNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "condition", // Use custom "condition" node type (octagon)
      data: { label: "Condition", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Function to add a user stage node (user icon)
  const addUserStageNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "userStage", // Use custom "userStage" node type
      data: { label: "User", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Function to add a stop stage node (red circle)
  const addStopStageNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "stopStage", // Use custom "stopStage" node type (red circle)
      data: { label: "Stop", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  // Function to delete a selected node or edge
  const deleteSelectedElement = () => {
    if (selectedElement?.id) {
      if (selectedElement.source && selectedElement.target) {
        // It's an edge
        setEdges((eds) => eds.filter((edge) => edge.id !== selectedElement.id));
      } else {
        // It's a node
        setNodes((nds) => nds.filter((node) => node.id !== selectedElement.id));
        setEdges((eds) =>
          eds.filter(
            (edge) =>
              edge.source !== selectedElement.id &&
              edge.target !== selectedElement.id
          )
        ); // Remove edges related to the node
      }
      setSelectedElement(null);
    }
  };

  // Function to handle selection changes (nodes or edges)
  const onSelectionChange = ({ nodes, edges }) => {
    if (nodes.length > 0) {
      setSelectedElement(nodes[0]);
    } else if (edges.length > 0) {
      setSelectedElement(edges[0]);
    } else {
      setSelectedElement(null);
    }
  };

  // Function to add new property to the selected node/edge
  const addProperty = () => {
    if (!newPropertyKey || !newPropertyValue) return;

    if (selectedElement?.data) {
      const updatedProperties = [
        ...(selectedElement.data.properties || []),
        { key: newPropertyKey, value: newPropertyValue },
      ];

      const updatedElement = {
        ...selectedElement,
        data: {
          ...selectedElement.data,
          properties: updatedProperties,
        },
      };

      // Update node or edge in the state
      if (selectedElement.source && selectedElement.target) {
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === selectedElement.id
              ? { ...edge, data: updatedElement.data }
              : edge
          )
        );
      } else {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === selectedElement.id ? updatedElement : node
          )
        );
      }

      // Update the selected element in the state
      setSelectedElement(updatedElement);

      // Clear input fields
      setNewPropertyKey("");
      setNewPropertyValue("");
    }
  };

  // Set edge type to "yes" for Yes connector
  const createYesConnector = () => {
    setEdgeType("yes");
  };

  // Set edge type to "no" for No connector
  const createNoConnector = () => {
    setEdgeType("no");
  };

  return (
    <div className="workflow-designer">
      <div className="sidebar">
        <button onClick={addNode}>Add Node</button>
        <button onClick={addConditionalNode}>Add Conditional Node</button>
        <button onClick={addUserStageNode}>Add User Stage</button>
        <button onClick={addStopStageNode}>Add Stop Stage</button>{" "}
        {/* Add Stop Stage Button */}
        <button onClick={deleteSelectedElement} disabled={!selectedElement}>
          Delete Selected
        </button>
        <button onClick={createYesConnector}>Add Yes Connector</button>
        <button onClick={createNoConnector}>Add No Connector</button>
        {/* Property Inputs */}
        {selectedElement && (
          <div className="properties-section">
            <h4>Properties</h4>
            <input
              type="text"
              placeholder="Property Key"
              value={newPropertyKey}
              onChange={(e) => setNewPropertyKey(e.target.value)}
              className="property-input"
            />
            <input
              type="text"
              placeholder="Property Value"
              value={newPropertyValue}
              onChange={(e) => setNewPropertyValue(e.target.value)}
              className="property-input"
            />
            <button onClick={addProperty} className="add-property-button">
              Add Property
            </button>

            <div className="property-list">
              <ul>
                {(selectedElement.data?.properties || []).map((prop, index) => (
                  <li key={index}>
                    {prop.key}: {prop.value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="diagram-area">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes} // Register custom node types
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
};

export default WorkflowDesigner;
