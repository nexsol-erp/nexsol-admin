import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Modeler from "bpmn-js/lib/Modeler";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  ZeebePropertiesProviderModule,
} from "bpmn-js-properties-panel";
import ZeebeModdle from "zeebe-bpmn-moddle/resources/zeebe.json";
import TlModdle from "./bpmn/tlModdle.json";
import { saveAs } from "file-saver";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "@bpmn-io/properties-panel/dist/assets/properties-panel.css";

import customModules from "./bpmn/customModules";
import {
  listWorkflowDefinitions,
  getWorkflowDefinition,
  saveWorkflowDraft,
  listWorkflowVersions,
  getWorkflowVersion,
  publishWorkflowVersion,
  validateWorkflowXml,
} from "../../services/apiservice";
import { canEditWorkflows } from "../../utils/workflowPermissions";
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

  const [canEdit] = useState(() => canEditWorkflows(JSON.parse(localStorage.getItem("roles") || "[]")));
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
  const [currentVersion, setCurrentVersion] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [historyDialogVisible, setHistoryDialogVisible] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [validationPanelVisible, setValidationPanelVisible] = useState(false);

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
      moddleExtensions: { zeebe: ZeebeModdle, tl: TlModdle },
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
      setCurrentVersion(null);
      setCurrentStatus(null);
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
      setCurrentVersion(res.data.version);
      setCurrentStatus(res.data.status);
      setOpenDialogVisible(false);
      setStatusMessage({ type: "success", text: `Opened "${id}" (v${res.data.version}, ${res.data.status}).` });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to open workflow: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  // Returns the saved version's metadata, or null on failure (status message already set).
  const saveDraft = async () => {
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const res = await saveWorkflowDraft(processId, processName, xml);
      setDirty(false);
      setCurrentVersion(res.data.version);
      setCurrentStatus(res.data.status);
      return res.data;
    } catch (err) {
      setStatusMessage({ type: "error", text: `Save failed: ${err.message}` });
      return null;
    }
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setStatusMessage(null);
    const saved = await saveDraft();
    if (saved) {
      setStatusMessage({ type: "success", text: `Saved as draft v${saved.version}.` });
    }
    setBusy(false);
  };

  // Focuses+selects a canvas element by id, e.g. from a clicked validation issue.
  const focusElement = (elementId) => {
    if (!elementId) return;
    const modeler = modelerRef.current;
    const element = modeler.get("elementRegistry").get(elementId);
    if (!element) return;
    modeler.get("selection").select(element);
    modeler.get("canvas").scrollToElement(element);
  };

  const runValidation = async (xml) => {
    const res = await validateWorkflowXml(xml);
    setValidationResult(res.data);
    setValidationPanelVisible(true);
    return res.data;
  };

  const handleValidate = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const result = await runValidation(xml);
      setStatusMessage({
        type: result.valid ? "success" : "error",
        text: result.valid
          ? `Valid${result.warnings.length ? ` (${result.warnings.length} warning(s))` : ""}.`
          : `${result.errors.length} error(s) found.`,
      });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Validation failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    setStatusMessage(null);
    try {
      const { xml: currentXml } = await modelerRef.current.saveXML({ format: true });
      const preCheck = await runValidation(currentXml);
      if (!preCheck.valid) {
        setStatusMessage({ type: "error", text: `Cannot publish: ${preCheck.errors.length} error(s) found. See validation panel.` });
        return;
      }

      let versionToPublish = currentVersion;
      if (dirty || currentStatus !== "DRAFT" || versionToPublish == null) {
        const saved = await saveDraft();
        if (!saved) return;
        versionToPublish = saved.version;
      }
      const changeNotes = window.prompt("Change notes for this publish (optional):", "") || "";
      const res = await publishWorkflowVersion(processId, versionToPublish, changeNotes);
      setCurrentVersion(res.data.version);
      setCurrentStatus(res.data.status);
      setValidationPanelVisible(false);
      setStatusMessage({ type: "success", text: `Published v${res.data.version}.` });
    } catch (err) {
      const data = err?.response?.data;
      if (data && Array.isArray(data.errors)) {
        // Structured validation failure from the server (e.g. a race with another editor).
        setValidationResult(data);
        setValidationPanelVisible(true);
        setStatusMessage({ type: "error", text: `Publish failed: ${data.errors.length} error(s) found. See validation panel.` });
      } else {
        setStatusMessage({ type: "error", text: `Publish failed: ${data?.error || err.message}` });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleShowVersionHistory = async () => {
    if (!processId) return;
    setBusy(true);
    try {
      const res = await listWorkflowVersions(processId);
      setVersionHistory(res.data || []);
      setHistoryDialogVisible(true);
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to load version history: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenVersion = async (version) => {
    if (!confirmDiscardIfDirty()) return;
    setBusy(true);
    try {
      const res = await getWorkflowVersion(processId, version);
      await modelerRef.current.importXML(res.data.bpmnXml);
      modelerRef.current.get("canvas").zoom("fit-viewport");
      refreshRootInfo();
      setDirty(false);
      setCurrentVersion(res.data.version);
      setCurrentStatus(res.data.status);
      setHistoryDialogVisible(false);
      setStatusMessage({ type: "success", text: `Loaded v${res.data.version} (${res.data.status}).` });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Failed to load version: ${err.message}` });
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
      setCurrentVersion(null);
      setCurrentStatus(null);
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
          <button onClick={handleNew} disabled={busy || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>New</button>
          <button onClick={openDefinitionsList} disabled={busy}>Open</button>
          <button onClick={handleSaveDraft} disabled={busy || !ready || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>
            {busy ? "Working..." : "Save Draft"}
          </button>
          <button onClick={handleValidate} disabled={busy || !ready}>Validate</button>
          <button onClick={handlePublish} disabled={busy || !ready || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>Publish</button>
          <button onClick={handleShowVersionHistory} disabled={busy || !processId}>Version History</button>
          <button onClick={handleImportClick} disabled={busy || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>Import BPMN</button>
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
          <button onClick={handleUndo} disabled={!canUndo || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>Undo</button>
          <button onClick={handleRedo} disabled={!canRedo || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>Redo</button>
          <button onClick={handleDeleteSelected} disabled={!hasSelection || !canEdit} title={!canEdit ? "Requires admin or system-admin role" : undefined}>Delete Selected</button>
        </div>
        {!canEdit && <div className="wd-toolbar-group wd-viewonly-badge">View only</div>}
        <div className="wd-toolbar-group wd-toolbar-status">
          <span className="wd-workflow-name">
            {processName} <span className="wd-process-id">({processId})</span>
          </span>
          {currentStatus && (
            <span className={`wd-status-badge wd-status-badge-${currentStatus.toLowerCase()}`}>
              v{currentVersion} · {currentStatus}
            </span>
          )}
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

      {validationPanelVisible && validationResult && (
        <div className="wd-validation-panel">
          <div className="wd-validation-panel-header">
            <span>
              {validationResult.valid ? "Valid" : `${validationResult.errors.length} error(s)`}
              {validationResult.warnings.length > 0 && `, ${validationResult.warnings.length} warning(s)`}
            </span>
            <button onClick={() => setValidationPanelVisible(false)}>×</button>
          </div>
          <ul className="wd-validation-issue-list">
            {validationResult.errors.map((issue, i) => (
              <li key={`err-${i}`} className="wd-validation-issue wd-validation-issue-error" onClick={() => focusElement(issue.elementId)}>
                <span className="wd-validation-issue-code">{issue.code}</span> {issue.message}
              </li>
            ))}
            {validationResult.warnings.map((issue, i) => (
              <li key={`warn-${i}`} className="wd-validation-issue wd-validation-issue-warning" onClick={() => focusElement(issue.elementId)}>
                <span className="wd-validation-issue-code">{issue.code}</span> {issue.message}
              </li>
            ))}
            {validationResult.valid && validationResult.warnings.length === 0 && (
              <li className="wd-validation-issue">No issues found.</li>
            )}
          </ul>
        </div>
      )}

      {openDialogVisible && (
        <div className="wd-modal-backdrop" onClick={() => setOpenDialogVisible(false)}>
          <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Open Workflow</h3>
            {definitions.length === 0 && <p>No saved workflows yet.</p>}
            <ul className="wd-definition-list">
              {definitions.map((d) => (
                <li key={d.processId}>
                  <button onClick={() => handleOpenSelected(d.processId)}>
                    {d.name} <span className="wd-process-id">({d.processId})</span>{" "}
                    <span className={`wd-status-badge wd-status-badge-${d.status.toLowerCase()}`}>
                      v{d.version} · {d.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setOpenDialogVisible(false)}>Cancel</button>
          </div>
        </div>
      )}

      {historyDialogVisible && (
        <div className="wd-modal-backdrop" onClick={() => setHistoryDialogVisible(false)}>
          <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Version History — {processName}</h3>
            {versionHistory.length === 0 && <p>No versions yet.</p>}
            <ul className="wd-definition-list">
              {versionHistory.map((v) => (
                <li key={v.version}>
                  <button onClick={() => handleOpenVersion(v.version)}>
                    <span className={`wd-status-badge wd-status-badge-${v.status.toLowerCase()}`}>
                      v{v.version} · {v.status}
                    </span>
                    <div className="wd-version-meta">
                      {v.status === "PUBLISHED" && v.publishedBy && (
                        <span>Published by {v.publishedBy} on {new Date(v.publishedAt).toLocaleString()}</span>
                      )}
                      {v.status !== "PUBLISHED" && v.createdBy && (
                        <span>Created by {v.createdBy} on {new Date(v.createdAt).toLocaleString()}</span>
                      )}
                      {v.changeNotes && <div className="wd-change-notes">{v.changeNotes}</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setHistoryDialogVisible(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
