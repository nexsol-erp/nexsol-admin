import { is, getBusinessObject } from "bpmn-js/lib/util/ModelUtil";

// Small helpers for reading/writing a custom extension-element type (like tl:FlowConfig)
// nested under bpmn:ExtensionElements — same command shape bpmn-js-properties-panel's own
// zeebe providers use internally (element.updateModdleProperties / multi-command-executor),
// just not exported from the package, so reimplemented here.

export function createModdleElement(bpmnFactory, type, properties, parent) {
  const el = bpmnFactory.create(type, properties);
  if (parent) el.$parent = parent;
  return el;
}

export function getExtensionElement(element, type) {
  const bo = getBusinessObject(element);
  const ee = bo.get("extensionElements");
  if (!ee) return null;
  return (ee.get("values") || []).find((v) => is(v, type));
}

/** Creates bpmn:ExtensionElements and the nested element if either is missing, in one atomic command. */
export function ensureExtensionElement(element, commandStack, bpmnFactory, type) {
  const existing = getExtensionElement(element, type);
  if (existing) return existing;

  const bo = getBusinessObject(element);
  let extensionElements = bo.get("extensionElements");
  const commands = [];

  if (!extensionElements) {
    extensionElements = createModdleElement(bpmnFactory, "bpmn:ExtensionElements", { values: [] }, bo);
    commands.push({
      cmd: "element.updateModdleProperties",
      context: { element, moddleElement: bo, properties: { extensionElements } },
    });
  }

  const newElement = createModdleElement(bpmnFactory, type, {}, extensionElements);
  commands.push({
    cmd: "element.updateModdleProperties",
    context: {
      element,
      moddleElement: extensionElements,
      properties: { values: [...(extensionElements.get("values") || []), newElement] },
    },
  });

  commandStack.execute("properties-panel.multi-command-executor", commands);
  return newElement;
}

export function setExtensionElementProp(element, commandStack, bpmnFactory, type, key, value) {
  const target = ensureExtensionElement(element, commandStack, bpmnFactory, type);
  commandStack.execute("element.updateModdleProperties", {
    element,
    moddleElement: target,
    properties: { [key]: value },
  });
}

export function getConditionBody(element) {
  const bo = getBusinessObject(element);
  return bo.conditionExpression && bo.conditionExpression.get("body");
}

export function setConditionBody(element, modeling, bpmnFactory, body) {
  const formalExpression = body ? bpmnFactory.create("bpmn:FormalExpression", { body }) : undefined;
  modeling.updateProperties(element, { conditionExpression: formalExpression });
}
