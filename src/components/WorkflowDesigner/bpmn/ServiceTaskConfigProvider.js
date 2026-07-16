import { is } from "bpmn-js/lib/util/ModelUtil";
import { useService } from "bpmn-js-properties-panel";
import {
  Group,
  SelectEntry,
  TextFieldEntry,
  TextAreaEntry,
  isSelectEntryEdited,
  isTextFieldEntryEdited,
  isTextAreaEntryEdited,
} from "@bpmn-io/properties-panel";
import { getExtensionElement, setExtensionElementProp } from "./moddleUtil";

const CONFIG_TYPE = "tl:ServiceConfig";

// Only HTTP and Kafka are exposed here — DbBackedEngine.executeBuiltIn() only actually
// dispatches those two (callHttp/callKafka). The engine also supports a "java.class"
// delegate path (callJava), but that lets whoever can edit a workflow name an arbitrary
// server-side class to instantiate via reflection; deliberately not surfacing that in the
// designer even though only admin/system-admin can edit workflows today.
const SERVICE_TYPES = [
  { key: "http", label: "REST endpoint (HTTP)" },
  { key: "kafka", label: "Kafka topic" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const ERROR_HANDLING = [
  { key: "fail", label: "Fail the process" },
  { key: "continue", label: "Continue (log and proceed)" },
];

function isServiceTask(element) {
  return is(element, "bpmn:ServiceTask");
}

function getConfig(element) {
  return getExtensionElement(element, CONFIG_TYPE);
}

function getProp(element, key, fallback = "") {
  const cfg = getConfig(element);
  return (cfg && cfg.get(key)) || fallback;
}

function setProp(element, commandStack, bpmnFactory, key, value) {
  setExtensionElementProp(element, commandStack, bpmnFactory, CONFIG_TYPE, key, value);
}

function ServiceTypeField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "service-type",
    label: translate("Call type"),
    getValue: () => getProp(element, "serviceType"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "serviceType", value),
    getOptions: () => [{ value: "", label: "" }, ...SERVICE_TYPES.map((t) => ({ value: t.key, label: translate(t.label) }))],
  });
}

function textField(id, label, description, key, fallback = "") {
  return function Field(props) {
    const { element } = props;
    const commandStack = useService("commandStack");
    const bpmnFactory = useService("bpmnFactory");
    const translate = useService("translate");
    const debounce = useService("debounceInput");

    return TextFieldEntry({
      element,
      id,
      label: translate(label),
      description: description ? translate(description) : undefined,
      getValue: () => getProp(element, key, fallback),
      setValue: (value) => setProp(element, commandStack, bpmnFactory, key, value),
      debounce,
    });
  };
}

const HttpUrlField = textField("http-url", "URL", null, "httpUrl");
const RetryCountField = textField("retry-count", "Retry count", "Additional attempts after the first failure", "retryCount", "0");
const RetryDelayField = textField("retry-delay", "Retry delay (ms)", null, "retryDelayMs", "0");
const TimeoutField = textField("timeout-ms", "Timeout (ms)", null, "timeoutMs", "10000");
const OutputVariableField = textField("output-variable", "Output variable", "Process variable to store the response body in", "outputVariable");
const KafkaTopicField = textField("kafka-topic", "Topic", null, "kafkaTopic");
const KafkaKeyField = textField("kafka-key", "Message key", "Defaults to the process instance id if left blank", "kafkaKey");

function HttpMethodField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "http-method",
    label: translate("Method"),
    getValue: () => getProp(element, "httpMethod", "POST"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "httpMethod", value),
    getOptions: () => HTTP_METHODS.map((m) => ({ value: m, label: m })),
  });
}

function HttpBodyField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");
  const debounce = useService("debounceInput");

  return TextAreaEntry({
    element,
    id: "http-body",
    label: translate("Request body (JSON)"),
    getValue: () => getProp(element, "httpBody", "{}"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "httpBody", value),
    rows: 4,
    monospace: true,
    debounce,
  });
}

function ErrorHandlingField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "error-handling",
    label: translate("On failure"),
    getValue: () => getProp(element, "errorHandling", "fail"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "errorHandling", value),
    getOptions: () => ERROR_HANDLING.map((e) => ({ value: e.key, label: translate(e.label) })),
  });
}

function ServiceTaskConfigGroup(element, injector) {
  if (!isServiceTask(element)) return null;
  const translate = injector.get("translate");
  const serviceType = getProp(element, "serviceType");

  const entries = [{ id: "service-type", component: ServiceTypeField, isEdited: isSelectEntryEdited }];

  if (serviceType === "kafka") {
    entries.push(
      { id: "kafka-topic", component: KafkaTopicField, isEdited: isTextFieldEntryEdited },
      { id: "kafka-key", component: KafkaKeyField, isEdited: isTextFieldEntryEdited }
    );
  } else {
    // Default to showing HTTP fields (matches executeBuiltIn's fallback when serviceType is blank).
    entries.push(
      { id: "http-url", component: HttpUrlField, isEdited: isTextFieldEntryEdited },
      { id: "http-method", component: HttpMethodField, isEdited: isSelectEntryEdited },
      { id: "http-body", component: HttpBodyField, isEdited: isTextAreaEntryEdited }
    );
  }

  entries.push(
    { id: "retry-count", component: RetryCountField, isEdited: isTextFieldEntryEdited },
    { id: "retry-delay", component: RetryDelayField, isEdited: isTextFieldEntryEdited },
    { id: "timeout-ms", component: TimeoutField, isEdited: isTextFieldEntryEdited },
    { id: "error-handling", component: ErrorHandlingField, isEdited: isSelectEntryEdited },
    { id: "output-variable", component: OutputVariableField, isEdited: isTextFieldEntryEdited }
  );

  return {
    id: "service-task-config",
    label: translate("Service call"),
    entries,
    component: Group,
  };
}

/**
 * Service-task execution config (tl:ServiceConfig extension), scoped to exactly what
 * DbBackedEngine.executeBuiltIn()/callHttp()/callKafka() dispatch on: an HTTP call or a
 * Kafka publish, both with configurable retry/timeout/on-failure behavior and an optional
 * output variable (HTTP response body only — Kafka is fire-and-forget).
 *
 * This depended on a real engine bug fix: ProcessController.deploy() used to register a
 * no-op ServiceTaskHandler for every service task type on every deploy, which always took
 * priority over executeBuiltIn()'s props-based dispatch — so this configuration would have
 * been silently inert without that fix.
 */
export default class ServiceTaskConfigProvider {
  constructor(propertiesPanel, injector) {
    this._injector = injector;
    propertiesPanel.registerProvider(650, this);
  }

  getGroups(element) {
    return (groups) => {
      const group = ServiceTaskConfigGroup(element, this._injector);
      if (group) groups.push(group);
      return groups;
    };
  }
}

ServiceTaskConfigProvider.$inject = ["propertiesPanel", "injector"];
