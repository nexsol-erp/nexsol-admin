import { is, isAny, getBusinessObject } from "bpmn-js/lib/util/ModelUtil";
import { useService } from "bpmn-js-properties-panel";
import {
  Group,
  SelectEntry,
  TextFieldEntry,
  CheckboxEntry,
  isSelectEntryEdited,
  isTextFieldEntryEdited,
  isCheckboxEntryEdited,
} from "@bpmn-io/properties-panel";
import { OPERATORS, VALUE_TYPES, buildExpression, parseExpression } from "./conditionExpression";

// DbBackedEngine.runUntilWait calls chooseOutgoing()/matchingOutgoings() — which evaluate
// each outgoing flow's condition — for EXCLUSIVE_GATEWAY, SERVICE_TASK, and USER_TASK nodes
// (e.g. HIMS.bpmn's "doctor" user task branches on conditions with no gateway at all).
// PARALLEL_GATEWAY always fires every branch (no conditions evaluated), and there's no
// inclusive gateway in the palette/parser at all, so neither gets this builder.
const CONDITIONAL_SOURCE_TYPES = ["bpmn:ExclusiveGateway", "bpmn:UserTask", "bpmn:ServiceTask", "bpmn:Task"];

function isConditionalSource(element) {
  return is(element, "bpmn:SequenceFlow") && element.source && isAny(element.source, CONDITIONAL_SOURCE_TYPES);
}

function getConditionBody(element) {
  const bo = getBusinessObject(element);
  return bo.conditionExpression && bo.conditionExpression.get("body");
}

function setConditionBody(element, modeling, bpmnFactory, body) {
  const formalExpression = body ? bpmnFactory.create("bpmn:FormalExpression", { body }) : undefined;
  modeling.updateProperties(element, { conditionExpression: formalExpression });
}

function currentFields(element) {
  return parseExpression(getConditionBody(element)) || { variable: "", operator: "eq", value: "", valueType: "string" };
}

function applyFields(element, modeling, bpmnFactory, patch) {
  const fields = { ...currentFields(element), ...patch };
  if (!fields.variable.trim()) return;
  const body = buildExpression(fields.variable, fields.operator, fields.value, fields.valueType);
  setConditionBody(element, modeling, bpmnFactory, body);
}

function VariableField(props) {
  const { element } = props;
  const modeling = useService("modeling");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");
  const debounce = useService("debounceInput");

  return TextFieldEntry({
    element,
    id: "condition-variable",
    label: translate("Variable"),
    description: translate("Process variable to compare, e.g. lab"),
    getValue: () => currentFields(element).variable,
    setValue: (value) => applyFields(element, modeling, bpmnFactory, { variable: value }),
    debounce,
  });
}

function OperatorField(props) {
  const { element } = props;
  const modeling = useService("modeling");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "condition-operator",
    label: translate("Operator"),
    getValue: () => currentFields(element).operator,
    setValue: (value) => applyFields(element, modeling, bpmnFactory, { operator: value }),
    getOptions: () => OPERATORS.map((o) => ({ value: o.key, label: translate(o.label) })),
  });
}

function ValueField(props) {
  const { element } = props;
  const modeling = useService("modeling");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");
  const debounce = useService("debounceInput");
  const fields = currentFields(element);
  const op = OPERATORS.find((o) => o.key === fields.operator);

  return TextFieldEntry({
    element,
    id: "condition-value",
    label: translate("Value"),
    description: op && !op.needsValue ? translate("Not used for this operator") : translate("Comma-separate multiple values for 'In list'"),
    disabled: op ? !op.needsValue : false,
    getValue: () => currentFields(element).value,
    setValue: (value) => applyFields(element, modeling, bpmnFactory, { value }),
    debounce,
  });
}

function ValueTypeField(props) {
  const { element } = props;
  const modeling = useService("modeling");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "condition-value-type",
    label: translate("Value type"),
    getValue: () => currentFields(element).valueType,
    setValue: (value) => applyFields(element, modeling, bpmnFactory, { valueType: value }),
    getOptions: () => VALUE_TYPES.map((t) => ({ value: t.key, label: translate(t.label) })),
  });
}

function DefaultFlowField(props) {
  const { element } = props;
  const modeling = useService("modeling");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  const isDefault = () => {
    const gateway = element.source;
    return gateway && gateway.businessObject.default === element.businessObject;
  };

  return CheckboxEntry({
    element,
    id: "condition-is-default",
    label: translate("Is default flow"),
    description: translate("Taken when no other outgoing flow's condition matches. Clears this flow's condition."),
    getValue: () => isDefault(),
    setValue: (checked) => {
      const gateway = element.source;
      if (!gateway) return;
      modeling.updateProperties(gateway, { default: checked ? element.businessObject : undefined });
      if (checked) {
        setConditionBody(element, modeling, bpmnFactory, undefined);
      }
    },
  });
}

function ConditionBuilderGroup(element, injector) {
  if (!isConditionalSource(element)) return null;
  const translate = injector.get("translate");
  const group = {
    id: "condition-builder",
    label: translate("Condition builder"),
    entries: [
      { id: "condition-is-default", component: DefaultFlowField, isEdited: isCheckboxEntryEdited },
      { id: "condition-variable", component: VariableField, isEdited: isTextFieldEntryEdited },
      { id: "condition-operator", component: OperatorField, isEdited: isSelectEntryEdited },
      { id: "condition-value", component: ValueField, isEdited: isTextFieldEntryEdited },
      { id: "condition-value-type", component: ValueTypeField, isEdited: isSelectEntryEdited },
    ],
    component: Group,
  };
  return group;
}

/**
 * Adds a structured variable/operator/value editor for exclusive-gateway outgoing flows,
 * alongside (not replacing) bpmn-js-properties-panel's built-in raw "Condition expression"
 * text field — both read/write the same conditionExpression.body, so either stays usable
 * as an escape hatch for expressions the builder's parser doesn't recognize.
 */
export default class ConditionBuilderProvider {
  constructor(propertiesPanel, injector) {
    this._injector = injector;
    propertiesPanel.registerProvider(600, this);
  }

  getGroups(element) {
    return (groups) => {
      const group = ConditionBuilderGroup(element, this._injector);
      if (group) groups.push(group);
      return groups;
    };
  }
}

ConditionBuilderProvider.$inject = ["propertiesPanel", "injector"];
