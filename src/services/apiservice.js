import axios from "axios";

const apiClient = axios.create();

// Read token and tenancyId fresh on every request so they're never stale
// (module-level reads would capture null before the user logs in)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwtToken");
  const tenancyId = localStorage.getItem("tenancyId");
  config.baseURL = `/api/${tenancyId}`;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getItems = () => {
  return apiClient.get("/items");
};

export const saveSalesTransaction = (salesTransaction) => {
  return apiClient.post("/sales", salesTransaction);
};

export const saveWorkflow = (workflowData) => {
  return apiClient.post("/workflow", workflowData);
};

export const loadWorkflow = (workflowName) => {
  return apiClient.get("/workflow/fetch", { params: { name: workflowName } });
};

// BPMN workflow designer — proxied through this backend to the miniflow
// workflow engine (see WorkflowDefinitionController).
export const listWorkflowDefinitions = () => {
  return apiClient.get("/workflow-definitions");
};

export const getWorkflowDefinition = (processId) => {
  return apiClient.get(`/workflow-definitions/${encodeURIComponent(processId)}`);
};

export const saveWorkflowDraft = (processId, name, bpmnXml) => {
  return apiClient.post(`/workflow-definitions/${encodeURIComponent(processId)}/draft`, { name, bpmnXml });
};

export const listWorkflowVersions = (processId) => {
  return apiClient.get(`/workflow-definitions/${encodeURIComponent(processId)}/versions`);
};

export const getWorkflowVersion = (processId, version) => {
  return apiClient.get(`/workflow-definitions/${encodeURIComponent(processId)}/versions/${version}`);
};

export const publishWorkflowVersion = (processId, version, changeNotes) => {
  return apiClient.post(
    `/workflow-definitions/${encodeURIComponent(processId)}/versions/${version}/publish`,
    { changeNotes }
  );
};

export const validateWorkflowXml = (bpmnXml) => {
  return apiClient.post("/workflow-definitions/validate", { bpmnXml });
};

// Running process instances — proxied through this backend to miniflow
// (see WorkflowInstanceController). No admin gate: starting/advancing an
// instance is a normal business action, not workflow authoring.
export const startWorkflowInstance = (processId, variables, businessKey) => {
  return apiClient.post(`/workflow-instances/${encodeURIComponent(processId)}/start`, { businessKey, variables });
};

export const getWorkflowInstance = (instanceId) => {
  return apiClient.get(`/workflow-instances/${encodeURIComponent(instanceId)}`);
};

export const getInstanceTasks = (instanceId) => {
  return apiClient.get(`/workflow-instances/${encodeURIComponent(instanceId)}/tasks`);
};

export const completeWorkflowTask = (taskId, updates) => {
  return apiClient.post(`/workflow-instances/tasks/${encodeURIComponent(taskId)}/complete`, { updates });
};

export const getMyTasks = (state, page = 0, size = 20) => {
  return apiClient.get("/workflow-instances/my-tasks", { params: { state, page, size } });
};
