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
import { saveWorkflow, loadWorkflow } from "../services/apiservice";
import "../styles/WorkflowDesigner.css";

// Node Components
const UserStageNode = ({ data }) => {
  const label = data?.label || "User";  // Fallback to "User" if label is missing
  return (
    <div>
      <svg width="60" height="60" viewBox="0 0 100 100">
        <circle cx="50" cy="30" r="15" fill="#007bff" /> {/* Head */}
        <rect x="35" y="50" width="30" height="40" fill="#007bff" /> {/* Body */}
        <text x="50%" y="95%" fill="white" fontSize="10" textAnchor="middle">
          {label}
        </text>
      </svg>
      <Handle
        type="target"
        position="left"
        style={{ left: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position="right"
        style={{ right: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
};

const ConditionNode = ({ data }) => {
  const label = data?.label || "Condition";  // Fallback to "Condition" if label is missing
  return (
    <div>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <polygon
          points="12,0 28,0 40,12 40,28 28,40 12,40 0,28 0,12"
          style={{ fill: "#d32f2f", stroke: "black", strokeWidth: 1 }}
        />
        <text x="50%" y="55%" fill="white" fontSize="8" textAnchor="middle">
          {label}
        </text>
      </svg>
      <Handle
        type="target"
        position="left"
        style={{ left: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position="right"
        style={{ right: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
};

const StopStageNode = ({ data }) => {
  const label = data?.label || "Stop";  // Fallback to "Stop" if label is missing
  return (
    <div>
      <svg width="60" height="60" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" fill="red" /> {/* Red Circle */}
        <text x="50%" y="55%" fill="white" fontSize="10" textAnchor="middle">
          {label}
        </text>
      </svg>
      <Handle
        type="target"
        position="left"
        style={{ left: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
};

// Custom Node for Start Stage (Green Circle)
const StartStageNode = ({ data }) => {
  const label = data?.label || "Start";  // Fallback to "Start" if label is missing
  return (
    <div>
      <svg width="80" height="80" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" fill="green" /> {/* Green Circle */}
        <text x="50%" y="55%" fill="white" fontSize="14" textAnchor="middle">
          {label}
        </text>
      </svg>
      <Handle type="source" position="right" />
    </div>
  );
};

// Custom Node with Left and Right Connectors
const CustomNode = ({ data }) => {
  const label = data?.label || "Node";  // Fallback to "Node" if label is missing
  return (
    <div>
      <svg width="60" height="60" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#00bcd4" /> {/* Rectangle */}
        <text x="50%" y="55%" fill="white" fontSize="10" textAnchor="middle">
          {label}
        </text>
      </svg>
      <Handle
        type="target"
        position="left"
        style={{ left: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position="right"
        style={{ right: "-8px", top: "50%", transform: "translateY(-50%)" }}
      />
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
  const [isSaving, setIsSaving] = useState(false); // Track saving state
  const [isFetching, setIsFetching] = useState(false); // Track saving state
  const [saveSuccess, setSaveSuccess] = useState(null); // Track save success/failure
  const [fetchSuccess, setFetchSuccess] = useState(null); // Track fetch success/failure
const [workflowName, setWorkflowName] = useState("");
  // Load Workflow function with edge transformation
  const loadTisWorkflow = async () => {
    setIsFetching(true); // Set loading state
    try {
      const response = await loadWorkflow(workflowName); // Fetch workflow from API
      const { nodes, edges } = response.data; // Destructure nodes and edges from the response

      // Transform the node structure to match the required format
      const updatedNodes = nodes.map((node) => {
        return {
          id: node.id,
          type: node.type === "null" || !node.type ? "userStage" : node.type, // Default to 'userStage' if 'type' is null
          data: {
            label: node.label || "User", // Fallback label
            properties: node.properties || [], // Custom properties
          },
          position: node.position || { x: 0, y: 0 }, // Ensure position exists
          width: node.width || 60, // Default width
          height: node.height || 66, // Default height
          label: node.label || "User", // Fallback to label 'User'
          selected: node.selected || false, // Ensure selected is present
          positionAbsolute: node.positionAbsolute || node.position, // Position absolute
          dragging: node.dragging || false, // Ensure dragging state exists
        };
      });

      // Transform the edge structure to match the required format
      const updatedEdges = edges.map((edge) => {
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label || "Next", // Default label for connectors
          data: {
            properties: edge.properties
              ? Object.entries(edge.properties).map(([key, value]) => ({
                  key,
                  value,
                }))
              : [], // Convert object to array if properties exist
          },
          sourceHandle: edge.sourceHandle || null, // Default to null if missing
          targetHandle: edge.targetHandle || null, // Default to null if missing
          animated: edge.animated || true, // Default to true if missing
          style: edge.style || { strokeWidth: 2 }, // Default style if missing
          selected: edge.selected || false, // Ensure selected is present
        };
      });

      setNodes(updatedNodes); // Update state with transformed nodes
      setEdges(updatedEdges); // Update state with transformed edges

      console.log("Workflow Fetched and Transformed Successfully:", {
        updatedNodes,
        updatedEdges,
      });
    } catch (error) {
      console.error("Error fetching workflow:", error);
    } finally {
      setIsFetching(false); // Reset loading state
    }
  };

  // Save Workflow function
  const saveTisWorkflow = async () => {
    setIsSaving(true); // Set loading state
    setSaveSuccess(null); // Clear any previous success or error message

    try {
        const workflowData = { name: workflowName, nodes, edges };
 
      const response = await saveWorkflow(workflowData);

      setSaveSuccess(true); // Set success state
      console.log("Workflow saved successfully:", response.data);
    } catch (error) {
      setSaveSuccess(false); // Set failure state
      console.error("Error saving workflow:", error);
    } finally {
      setIsSaving(false); // Reset loading state
    }
  };

  // Function to show all attributes in an alert box
  // Function to show all attributes in an alert box
  // Function to show the entire data structure in an alert box
  const showPropertiesAlert = () => {
    if (selectedElement) {
      // Convert the entire selected element to a string using JSON.stringify
      const elementData = JSON.stringify(selectedElement, null, 2); // Pretty print with 2-space indentation

      // Display the data structure in an alert box
      //alert(`Selected Element Data:\n${elementData}`);
      console.debug(elementData);
    } else {
      alert("No element selected.");
    }
  };

  // Add visual feedback for the Save Workflow button
  const getButtonLabel = () => {
    if (isSaving) return "Saving...";
    if (saveSuccess === true) return "Saved!";
    if (saveSuccess === false) return "Save Failed";
    return "Save Workflow";
  };

  const getFetchButtonLabel = () => {
    if (isFetching) return "Fetching...";
    if (fetchSuccess === true) return "Fetched!";
    if (fetchSuccess === false) return "Fetch Failed";
    return "Fetch Workflow";
  };

  // Function to handle node/edge selection
  const onSelectionChange = ({ nodes, edges }) => {
    if (nodes.length > 0) {
      setSelectedElement(nodes[0]);
    } else if (edges.length > 0) {
      setSelectedElement(edges[0]);
    } else {
      setSelectedElement(null);
    }
  };

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
      position: { x: Math.random() * 200, y: Math.random() * 200 },
      label: "Node",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addConditionalNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "condition", // Custom "condition" node type (octagon)
      data: { label: "Condition", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      label: "Condition",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addUserStageNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "userStage", // Custom "userStage" node type
      data: { label: "User", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      label: "User",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addStopStageNode = () => {
    const newNode = {
      id: `${nodes.length + 1}`,
      type: "stopStage", // Custom "stopStage" node type (red circle)
      data: { label: "Stop", properties: [] },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      label: "Stop",
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

  // Function to add a new property to the selected node/edge
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

  return (
    <div className="workflow-designer">
      <div className="sidebar">
        {/* Input field to capture workflow name */}
        <div className="workflow-name">
          <label htmlFor="workflow-name">Workflow Name:</label>
          <input
            type="text"
            id="workflow-name"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Enter workflow name"
          />
        </div>
        <button onClick={addNode}>Add Node</button>
        <button onClick={addConditionalNode}>Add Conditional Node</button>
        <button onClick={addUserStageNode}>Add User Stage</button>
        <button onClick={addStopStageNode}>Add Stop Stage</button>{" "}
        {/* Add Stop Stage Button */}
        <button onClick={deleteSelectedElement} disabled={!selectedElement}>
          Delete Selected
        </button>
        <button onClick={saveTisWorkflow} disabled={isSaving}>
          {getButtonLabel()}
        </button>
        <button onClick={loadTisWorkflow} disabled={isFetching}>
          {getFetchButtonLabel()}
        </button>
        <button onClick={showPropertiesAlert} disabled={!selectedElement}>
          Show Properties in Alert
        </button>
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
