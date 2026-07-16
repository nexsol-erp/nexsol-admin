/**
 * Strips context-pad entries that would let a user create BPMN elements
 * miniflow's SimpleBpmnParser doesn't execute:
 *  - "replace" opens the full change-type popup (script/business-rule/send/
 *    receive/manual task, inclusive/event-based/complex gateway, etc.)
 *  - "append.intermediate-event" quick-appends an intermediate throw event,
 *    which the parser silently drops (falls through its switch's default).
 * Everything else (append end-event/task/gateway/text-annotation, connect,
 * delete) already only produces types the parser understands.
 */
export default class CustomContextPadProvider {
  constructor(contextPad) {
    // Lower priority than the built-in BpmnContextPadProvider's default
    // (1000), so it runs after and receives the already-populated entries
    // to filter rather than building the pad from scratch.
    contextPad.registerProvider(700, this);
  }

  getContextPadEntries(element) {
    return function (entries) {
      delete entries["replace"];
      delete entries["append.intermediate-event"];
      return entries;
    };
  }
}

CustomContextPadProvider.$inject = ["contextPad"];
