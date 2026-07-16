import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Modeler from "bpmn-js/lib/Modeler";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule,
} from "bpmn-js-properties-panel";
import ZeebeModdle from "zeebe-bpmn-moddle/resources/zeebe.json";
import { saveAs } from "file-saver";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "@bpmn-io/properties-panel/dist/assets/properties-panel.css";

import customModules from "./bpmn/customModules";
import {
  listWorkflowDefinitions,
  getWorkflowDefinition,
  deployWorkflowDefinition,
} from "../../services/apiservice";
import "./WorkflowDesigner.css";

function blankDiagram() {
  const processId = `Process_${Date.now()}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="New Workflow" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

export default function WorkflowDesignerPage() {
  const canvasRef = useRef(null);
  const propertiesRef = useRef(null);
  const modelerRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [processName, setProcessName] = useState("New Workflow");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [openDialogVisible, setOpenDialogVisible] = useState(false);
  const [definitions, setDefinitions] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  const refreshRootInfo = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;
    try {
      const elementRegistry = modeler.get("elementRegistry");
      const rootElement = elementRegistry.getAll().find((el) => el.type === "bpmn:Process");
      if (rootElement) {
        setProcessId(rootElement.businessObject.id);
        setProcessName(rootElement.businessObject.name || rootElement.businessObject.id);
      }
    } catch (err) {
      // canvas not ready yet
    }
  }, []);

  useEffect(() => {
    const modeler = new Modeler({
      container: canvasRef.current,
      propertiesPanel: { parent: propertiesRef.current },
      additionalModules: [
        customModules,
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        ZeebePropertiesProviderModule,
      ],
      moddleExtensions: { zeebe: ZeebeModdle },
    });
    modelerRef.current = modeler;

    modeler
      .importXML(blankDiagram())
      .then(() => {
        modeler.get("canvas").zoom("fit-viewport");
        refreshRootInfo();
        setReady(true);
      })
      .catch((err) => setStatusMessage({ type: "error", text: `Failed to initialize canvas: ${err.message}` }));

    const eventBus = modeler.get("eventBus");
    const commandStack = modeler.get("commandStack");
    const selection = modeler.get("selection");

    const onChanged = () => {
      setDirty(true);
      setCanUndo(commandStack.canUndo());
      setCanRedo(commandStack.canRedo());
      refreshRootInfo();
    };
    const onSelectionChanged = (e) => setHasSelection((e.newSelection || []).length > 0);

    eventBus.on("commandStack.changed", onChanged);
    eventBus.on("selection.changed", onSelectionChanged);

    return () => {
      eventBus.off("commandStack.changed", onChanged);
      eventBus.off("selection.changed", onSelectionChanged);
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const confirmDiscardIfDirty = () => {
    if (!dirty) return true;
    return window.confirm("You have unsaved changes. Discard them and continue?");
  };

  const handleNew = async () => {
    if (!confirmDiscardIfDirty()) return;
    const modeler = modelerRef.current;
    try {
      await modeler.importXML(blankDiagram());
      modeler.get("canvas").zoom("fit-viewport");
      refreshRootInfo();
      setDirty(false);
      setStatusMessage(null);
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to create new workflow: ${err.message}` });
    }
  };

  const openDefinitionsList = async () => {
    setBusy(true);
    try {
      const res = await listWorkflowDefinitions();
      setDefinitions(res.data || []);
      setOpenDialogVisible(true);
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to load workflow list: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSelected = async (id) => {
    if (!confirmDiscardIfDirty()) return;
    setBusy(true);
    try {
      const res = await getWorkflowDefinition(id);
      await modelerRef.current.importXML(res.data.bpmnXml);
      modelerRef.current.get("canvas").zoom("fit-viewport");
      refreshRootInfo();
      setDirty(false);
      setOpenDialogVisible(false);
      setStatusMessage({ type: "success", text: `Opened "${id}".` });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to open workflow: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      await deployWorkflowDefinition(xml, `${processId || "workflow"}.bpmn`);
      setDirty(false);
      setStatusMessage({ type: "success", text: "Saved." });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Save failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (!confirmDiscardIfDirty()) return;
    try {
      const xml = await file.text();
      await modelerRef.current.importXML(xml);
      modelerRef.current.get("canvas").zoom("fit-viewport");
      refreshRootInfo();
      setDirty(true);
      setStatusMessage({ type: "success", text: `Imported "${file.name}". Not yet saved.` });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to import BPMN: ${err.message}` });
    }
  };

  const handleExport = async () => {
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml], { type: "application/xml" });
      saveAs(blob, `${processId || "workflow"}.bpmn`);
    } catch (err) {
      setStatusMessage({ type: "error", text: `Export failed: ${err.message}` });
    }
  };

  const handleZoom = (delta) => modelerRef.current.get("zoomScroll").stepZoom(delta);
  const handleFit = () => modelerRef.current.get("canvas").zoom("fit-viewport");
  const handleUndo = () => modelerRef.current.get("commandStack").undo();
  const handleRedo = () => modelerRef.current.get("commandStack").redo();

  const handleDeleteSelected = () => {
    const modeler = modelerRef.current;
    const selected = modeler.get("selection").get();
    if (selected.length === 0) return;
    modeler.get("modeling").removeElements(selected);
  };

  const handleClose = () => {
    if (!confirmDiscardIfDirty()) return;
    navigate(-1);
  };

  return (
    <div className="workflow-designer-page">
      <div className="wd-toolbar">
        <div className="wd-toolbar-group">
          <button onClick={handleNew} disabled={busy}>New</button>
          <button onClick={openDefinitionsList} disabled={busy}>Open</button>
          <button onClick={handleSaveDraft} disabled={busy || !ready}>
            {busy ? "Saving..." : "Save Draft"}
          </button>
          <button onClick={handleImportClick} disabled={busy}>Import BPMN</button>
          <button onClick={handleExport} disabled={busy || !ready}>Export BPMN</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bpmn,.xml"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
        </div>
        <div className="wd-toolbar-group">
          <button onClick={() => handleZoom(1)} disabled={!ready}>Zoom In</button>
          <button onClick={() => handleZoom(-1)} disabled={!ready}>Zoom Out</button>
          <button onClick={handleFit} disabled={!ready}>Fit to Screen</button>
          <button onClick={handleUndo} disabled={!canUndo}>Undo</button>
          <button onClick={handleRedo} disabled={!canRedo}>Redo</button>
          <button onClick={handleDeleteSelected} disabled={!hasSelection}>Delete Selected</button>
        </div>
        <div className="wd-toolbar-group wd-toolbar-status">
          <span className="wd-workflow-name">
            {processName} <span className="wd-process-id">({processId})</span>
          </span>
          <span className={`wd-dirty-indicator ${dirty ? "dirty" : "clean"}`}>
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <button onClick={handleClose}>Close Designer</button>
        </div>
      </div>

      {statusMessage && (
        <div className={`wd-status-bar wd-status-${statusMessage.type}`}>{statusMessage.text}</div>
      )}

      <div className="wd-body">
        <div className="wd-canvas" ref={canvasRef} />
        <div className="wd-properties" ref={propertiesRef} />
      </div>

      {openDialogVisible && (
        <div className="wd-modal-backdrop" onClick={() => setOpenDialogVisible(false)}>
          <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Open Workflow</h3>
            {definitions.length === 0 && <p>No saved workflows yet.</p>}
            <ul className="wd-definition-list">
              {definitions.map((d) => (
                <li key={d.processId}>
                  <button onClick={() => handleOpenSelected(d.processId)}>
                    {d.name} <span className="wd-process-id">({d.processId})</span>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setOpenDialogVisible(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
