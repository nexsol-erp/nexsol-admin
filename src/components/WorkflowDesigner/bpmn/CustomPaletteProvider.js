import { assign } from "min-dash";

/**
 * Replaces bpmn-js's default palette with only the elements miniflow's
 * SimpleBpmnParser actually executes (start/end event, user/service task,
 * exclusive/parallel gateway, text annotation). Registered as the sole
 * `paletteProvider` (see bpmnModules.js) so nothing from the stock palette
 * leaks through — anything not listed here can't be dragged onto the canvas.
 */
export default class CustomPaletteProvider {
  constructor(palette, create, elementFactory, spaceTool, lassoTool, handTool, globalConnect, translate) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.spaceTool = spaceTool;
    this.lassoTool = lassoTool;
    this.handTool = handTool;
    this.globalConnect = globalConnect;
    this.translate = translate;

    palette.registerProvider(this);
  }

  getPaletteEntries() {
    const { create, elementFactory, spaceTool, lassoTool, handTool, globalConnect, translate } = this;

    function createAction(type, group, className, title, options) {
      function createListener(event) {
        const shape = elementFactory.createShape(assign({ type }, options));
        create.start(event, shape);
      }

      return {
        group,
        className,
        title: title || translate("Create " + type.replace(/^bpmn:/, "")),
        action: {
          dragstart: createListener,
          click: createListener,
        },
      };
    }

    return {
      "hand-tool": {
        group: "tools",
        className: "bpmn-icon-hand-tool",
        title: translate("Activate the hand tool"),
        action: {
          click: (event) => handTool.activateHand(event),
        },
      },
      "lasso-tool": {
        group: "tools",
        className: "bpmn-icon-lasso-tool",
        title: translate("Activate the lasso tool"),
        action: {
          click: (event) => lassoTool.activateSelection(event),
        },
      },
      "space-tool": {
        group: "tools",
        className: "bpmn-icon-space-tool",
        title: translate("Activate the create/remove space tool"),
        action: {
          click: (event) => spaceTool.activateSelection(event),
        },
      },
      "global-connect-tool": {
        group: "tools",
        className: "bpmn-icon-connection-multi",
        title: translate("Activate the global connect tool"),
        action: {
          click: (event) => globalConnect.toggle(event),
        },
      },
      "tool-separator": {
        group: "tools",
        separator: true,
      },
      "create.start-event": createAction(
        "bpmn:StartEvent",
        "event",
        "bpmn-icon-start-event-none",
        translate("Create Start Event")
      ),
      "create.end-event": createAction(
        "bpmn:EndEvent",
        "event",
        "bpmn-icon-end-event-none",
        translate("Create End Event")
      ),
      "create.exclusive-gateway": createAction(
        "bpmn:ExclusiveGateway",
        "gateway",
        "bpmn-icon-gateway-xor",
        translate("Create Exclusive Gateway")
      ),
      "create.parallel-gateway": createAction(
        "bpmn:ParallelGateway",
        "gateway",
        "bpmn-icon-gateway-parallel",
        translate("Create Parallel Gateway")
      ),
      "gateway-separator": {
        group: "gateway",
        separator: true,
      },
      "create.user-task": createAction(
        "bpmn:UserTask",
        "activity",
        "bpmn-icon-user-task",
        translate("Create User Task")
      ),
      "create.service-task": createAction(
        "bpmn:ServiceTask",
        "activity",
        "bpmn-icon-service-task",
        translate("Create Service Task")
      ),
      "create.text-annotation": createAction(
        "bpmn:TextAnnotation",
        "artifact",
        "bpmn-icon-text-annotation",
        translate("Create Text Annotation")
      ),
    };
  }
}

CustomPaletteProvider.$inject = [
  "palette",
  "create",
  "elementFactory",
  "spaceTool",
  "lassoTool",
  "handTool",
  "globalConnect",
  "translate",
];
