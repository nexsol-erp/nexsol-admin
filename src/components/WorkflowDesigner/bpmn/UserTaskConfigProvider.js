import { is } from "bpmn-js/lib/util/ModelUtil";
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
import { getExtensionElement, setExtensionElementProp } from "./moddleUtil";

const CONFIG_TYPE = "tl:UserTaskConfig";

// ROLE and DEPARTMENT are resolved the same way as GROUP at runtime — DbBackedEngine treats
// "assignedGroup" as a candidate-group name regardless of which of the three was picked, and
// nexsol-server-postgress's existing ROLES/USERS_ROLES table (already generic, admin-managed,
// many-to-many) is reused as the group/role/department membership source. There's no separate
// concept of a "department" in this app today, so DEPARTMENT is really just a differently-named
// role for now.
const ASSIGNMENT_TYPES = [
  { key: "USER", label: "User" },
  { key: "GROUP", label: "Group" },
  { key: "ROLE", label: "Role" },
  { key: "DEPARTMENT", label: "Department" },
];

const PRIORITIES = [
  { key: "LOW", label: "Low" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HIGH", label: "High" },
  { key: "URGENT", label: "Urgent" },
];

function isUserTask(element) {
  return is(element, "bpmn:UserTask");
}

function getConfig(element) {
  return getExtensionElement(element, CONFIG_TYPE);
}

function getProp(element, key, fallback = "") {
  const cfg = getConfig(element);
  const value = cfg && cfg.get(key);
  return value === undefined || value === null ? fallback : value;
}

function setProp(element, commandStack, bpmnFactory, key, value) {
  setExtensionElementProp(element, commandStack, bpmnFactory, CONFIG_TYPE, key, value);
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

function checkboxField(id, label, description, key) {
  return function Field(props) {
    const { element } = props;
    const commandStack = useService("commandStack");
    const bpmnFactory = useService("bpmnFactory");
    const translate = useService("translate");

    return CheckboxEntry({
      element,
      id,
      label: translate(label),
      description: description ? translate(description) : undefined,
      getValue: () => !!getProp(element, key, false),
      setValue: (value) => setProp(element, commandStack, bpmnFactory, key, value),
    });
  };
}

const StepNameField = textField("step-name", "Step name", "Business-friendly name shown in the task inbox", "stepName");
const MenuNameField = textField(
  "menu-name",
  "Menu name",
  "Must exactly match an ERP menu name — the workflow engine opens this menu and passes the business object id when the task is clicked",
  "menuName"
);
const BusinessObjectTypeField = textField("business-object-type", "Business object type", "e.g. Purchase, SalesOrder, LeaveRequest", "businessObjectType");
const AssignedUserField = textField("assigned-user", "Assigned user", null, "assignedUser");
const AssignedGroupField = textField("assigned-group", "Assigned group", "Matches a role/group name in Role Management — every member sees this task until someone completes it", "assignedGroup");
const SlaField = textField("sla", "SLA", "e.g. 4h, 1d", "sla");
const DueDaysField = textField("due-days", "Due days", "Days from task creation until due", "dueDays");

const AllowClaimField = checkboxField("allow-claim", "Allow claim", "Group/role/department tasks can be explicitly claimed by one member", "allowClaim");
const AllowReassignField = checkboxField("allow-reassign", "Allow reassign", null, "allowReassign");
const AllowDelegateField = checkboxField("allow-delegate", "Allow delegate", null, "allowDelegate");
const RequireCommentField = checkboxField("require-comment", "Require comment on complete", null, "requireCommentOnComplete");
const RequireAttachmentField = checkboxField("require-attachment", "Require attachment", null, "requireAttachment");

function AssignmentTypeField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "assignment-type",
    label: translate("Assignment type"),
    getValue: () => getProp(element, "assignmentType"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "assignmentType", value),
    getOptions: () => [{ value: "", label: "" }, ...ASSIGNMENT_TYPES.map((t) => ({ value: t.key, label: translate(t.label) }))],
  });
}

function PriorityField(props) {
  const { element } = props;
  const commandStack = useService("commandStack");
  const bpmnFactory = useService("bpmnFactory");
  const translate = useService("translate");

  return SelectEntry({
    element,
    id: "priority",
    label: translate("Priority"),
    getValue: () => getProp(element, "priority"),
    setValue: (value) => setProp(element, commandStack, bpmnFactory, "priority", value),
    getOptions: () => [{ value: "", label: "" }, ...PRIORITIES.map((p) => ({ value: p.key, label: translate(p.label) }))],
  });
}

function UserTaskConfigGroup(element, injector) {
  if (!isUserTask(element)) return null;
  const translate = injector.get("translate");
  const assignmentType = getProp(element, "assignmentType");

  const entries = [
    { id: "step-name", component: StepNameField, isEdited: isTextFieldEntryEdited },
    { id: "menu-name", component: MenuNameField, isEdited: isTextFieldEntryEdited },
    { id: "business-object-type", component: BusinessObjectTypeField, isEdited: isTextFieldEntryEdited },
    { id: "assignment-type", component: AssignmentTypeField, isEdited: isSelectEntryEdited },
  ];

  if (assignmentType === "USER") {
    entries.push({ id: "assigned-user", component: AssignedUserField, isEdited: isTextFieldEntryEdited });
  } else if (assignmentType === "GROUP" || assignmentType === "ROLE" || assignmentType === "DEPARTMENT") {
    entries.push({ id: "assigned-group", component: AssignedGroupField, isEdited: isTextFieldEntryEdited });
  }

  entries.push(
    { id: "sla", component: SlaField, isEdited: isTextFieldEntryEdited },
    { id: "priority", component: PriorityField, isEdited: isSelectEntryEdited },
    { id: "due-days", component: DueDaysField, isEdited: isTextFieldEntryEdited },
    { id: "allow-claim", component: AllowClaimField, isEdited: isCheckboxEntryEdited },
    { id: "allow-reassign", component: AllowReassignField, isEdited: isCheckboxEntryEdited },
    { id: "allow-delegate", component: AllowDelegateField, isEdited: isCheckboxEntryEdited },
    { id: "require-comment", component: RequireCommentField, isEdited: isCheckboxEntryEdited },
    { id: "require-attachment", component: RequireAttachmentField, isEdited: isCheckboxEntryEdited }
  );

  return {
    id: "user-task-config",
    label: translate("Task configuration"),
    entries,
    component: Group,
  };
}

/**
 * Generic user-task metadata (tl:UserTaskConfig extension) — deliberately not tied to any
 * specific business process, so the same fields work for Purchase Entry, GRN Receipt, Sales,
 * Leave Approval, etc. without code changes. DbBackedEngine reads assignmentType/assignedUser/
 * assignedGroup to resolve the task's assignee or candidate group at runtime, and menuName as
 * the task's formKey — the "which ERP menu to open" hook a future menu-launcher reads, alongside
 * the instance's businessKey/variables for the business object id, with no hardcoded mapping.
 */
export default class UserTaskConfigProvider {
  constructor(propertiesPanel, injector) {
    this._injector = injector;
    propertiesPanel.registerProvider(650, this);
  }

  getGroups(element) {
    return (groups) => {
      const group = UserTaskConfigGroup(element, this._injector);
      if (group) groups.push(group);
      return groups;
    };
  }
}

UserTaskConfigProvider.$inject = ["propertiesPanel", "injector"];
