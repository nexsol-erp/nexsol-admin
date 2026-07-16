import { is } from "bpmn-js/lib/util/ModelUtil";
import { useService } from "bpmn-js-properties-panel";
import { Group, SelectEntry, TextFieldEntry, isSelectEntryEdited, isTextFieldEntryEdited } from "@bpmn-io/properties-panel";
import { buildExpression } from "./conditionExpression";
import { getExtensionElement, setExtensionElementProp, setConditionBody } from "./moddleUtil";

const FLOW_CONFIG_TYPE = "tl:FlowConfig";

// Approval semantics only make sense for outgoing flows from a human task — the outcome
// a user picks when completing the task (see DbBackedEngine.completeUserTask, which merges
// whatever "updates" the caller sends into instance variables before evaluating outgoing
// conditions). This project has no task-completion UI yet to establish that convention, so
// this builder defines it: the completing caller is expected to send an `outcome` variable
// (e.g. { outcome: "APPROVED" }), matching the condition this generates.
const ACTIONS = [
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "SENT_BACK", label: "Sent back" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "ESCALATED", label: "Escalated" },
  { key: "CUSTOM", label: "Custom…" },
];

function isUserTaskFlow(element) {
  return is(element, "bpmn:SequenceFlow") && element.source && is(element.source, "bpmn:UserTask");
}

function getFlowConfig(element) {
  return getExtensionElement(element, FLOW_CONFIG_TYPE);
}

function FlowCodeField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");
  const debounce = useService("debounceInput");

  return TextFieldEntry({
    element,
    id: "flow-code",
    label: translate("Flow code"),
    description: translate("Optional business identifier for this transition, e.g. MGR_APPROVE"),
    getValue: () => {
      const fc = getFlowConfig(element);
      return (fc && fc.get("flowCode")) || "";
    },
    setValue: (value) => setExtensionElementProp(element, commandStack, bpmnFactory, FLOW_CONFIG_TYPE, "flowCode", value),
    debounce,
  });
}

function TransitionActionField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const modeling = useService("modeling");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "transition-action",
    label: translate("Transition action"),
    getValue: () => {
      const fc = getFlowConfig(element);
      return (fc && fc.get("transitionAction")) || "";
    },
    setValue: (value) => {
      setExtensionElementProp(element, commandStack, bpmnFactory, FLOW_CONFIG_TYPE, "transitionAction", value);
      if (value && value !== "CUSTOM") {
        setExtensionElementProp(element, commandStack, bpmnFactory, FLOW_CONFIG_TYPE, "requiredOutcome", value);
        setConditionBody(element, modeling, bpmnFactory, buildExpression("outcome", "eq", value, "string"));
      }
    },
    getOptions: () => [{ value: "", label: "" }, ...ACTIONS.map((a) => ({ value: a.key, label: translate(a.label) }))],
  });
}

function RequiredOutcomeField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const modeling = useService("modeling");
  const translate = useService("translate");
  const debounce = useService("debounceInput");

  return TextFieldEntry({
    element,
    id: "required-outcome",
    label: translate("Required outcome"),
    description: translate("Value the completed task's `outcome` variable must equal for this flow to be taken"),
    getValue: () => {
      const fc = getFlowConfig(element);
      return (fc && fc.get("requiredOutcome")) || "";
    },
    setValue: (value) => {
      setExtensionElementProp(element, commandStack, bpmnFactory, FLOW_CONFIG_TYPE, "requiredOutcome", value);
      setConditionBody(element, modeling, bpmnFactory, buildExpression("outcome", "eq", value, "string"));
    },
    debounce,
  });
}

function ApprovalTransitionGroup(element, injector) {
  if (!isUserTaskFlow(element)) return null;
  const translate = injector.get("translate");
  return {
    id: "approval-transition",
    label: translate("Approval transition"),
    entries: [
      { id: "transition-action", component: TransitionActionField, isEdited: isSelectEntryEdited },
      { id: "required-outcome", component: RequiredOutcomeField, isEdited: isTextFieldEntryEdited },
      { id: "flow-code", component: FlowCodeField, isEdited: isTextFieldEntryEdited },
    ],
    component: Group,
  };
}

/**
 * Convenience layer on top of the Condition builder for the common "task completed with
 * outcome X" pattern: picking a preset action (Approved/Rejected/...) fills a required-
 * outcome value and writes the matching `outcome == '...'` condition for you, while
 * Required outcome stays independently editable for custom values. Flow code is purely
 * descriptive metadata (tl:FlowConfig.flowCode), stored the same way the original
 * claude-prompt.md spec sketched — a small custom moddle extension under
 * bpmn:ExtensionElements — since SimpleBpmnParser already captures any extension
 * element's attributes generically, no backend change is needed to read it back.
 */
export default class ApprovalTransitionProvider {
  constructor(propertiesPanel, injector) {
    this._injector = injector;
    propertiesPanel.registerProvider(650, this);
  }

  getGroups(element) {
    return (groups) => {
      const group = ApprovalTransitionGroup(element, this._injector);
      if (group) groups.push(group);
      return groups;
    };
  }
}

ApprovalTransitionProvider.$inject = ["propertiesPanel", "injector"];
