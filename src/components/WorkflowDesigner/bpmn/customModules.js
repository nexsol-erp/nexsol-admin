import CustomPaletteProvider from "./CustomPaletteProvider";
import CustomContextPadProvider from "./CustomContextPadProvider";
import ConditionBuilderProvider from "./ConditionBuilderProvider";

// `paletteProvider` is the exact DI name bpmn-js's built-in palette module
// binds under. Declaring the same name here — loaded as an additionalModule,
// after the built-ins — makes didi's last-registration-wins rule replace it
// outright (the stock provider's registerProvider() call never runs), which
// is what actually restricts the palette instead of layering another
// provider next to the stock one (Palette merges providers by key, so a
// second provider only overrides matching keys and leaves the rest).
//
// The context-pad works differently: CustomContextPadProvider registers
// itself as an *additional* provider (own DI name, not overriding
// `contextPadProvider`) at a priority that runs after the built-in one, so
// it can filter the entries the built-in provider already produced rather
// than reimplementing the whole context pad from scratch.
// ConditionBuilderProvider registers itself as an additional properties-panel provider
// (own DI name, same additive pattern the built-in ZeebePropertiesProvider uses) so its
// "Condition builder" group appears alongside the stock groups, not instead of them.
export default {
  __init__: ["paletteProvider", "customContextPadProvider", "conditionBuilderProvider"],
  paletteProvider: ["type", CustomPaletteProvider],
  customContextPadProvider: ["type", CustomContextPadProvider],
  conditionBuilderProvider: ["type", ConditionBuilderProvider],
};
