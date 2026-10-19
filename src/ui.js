// Core component factory
import createComponent from "./core/createComponent.js";

// Component classes
import ElementComponent from "./components/Element.js";
import TextComponent from "./components/Text.js";
import ButtonComponent from "./components/Button.js";
import CardComponent from "./components/Card.js";
import RowComponent from "./components/Row.js";
import ColumnComponent from "./components/Column.js";

// Navigation classes
import Screen from "./navigation/Screen.js";
import ScreenBase from "./navigation/ScreenBase.js";
import ScreenRegistry from "./navigation/ScreenRegistry.js";
import ScreenManager from "./navigation/ScreenManager.js";
import TabNavigator from "./navigation/TabNavigator.js";
import ScreenHost from "./navigation/ScreenHost.js";

// Public component API
export const Element = createComponent(ElementComponent);
export const Text = createComponent(TextComponent);
export const Button = createComponent(ButtonComponent);
export const Card = createComponent(CardComponent);
export const Row = createComponent(RowComponent);
export const Column = createComponent(ColumnComponent);

// Public core API
export { default as validateComponent } from "./core/validateComponent.js";
export { default as validateDefinition } from "./core/validateDefinition.js";
export { default as normalizeComponent } from "./core/normalizeComponent.js";

// Public schema API
export {
    registerComponentSchema,
    getComponentSchema,
    hasComponentSchema,
    listComponentTypes,
    COMMON_PROPERTIES,
    COMPONENT_SCHEMAS
} from "./core/componentSchemas.js";

// Public navigation API
export {
    Screen,
    ScreenBase,
    ScreenRegistry,
    ScreenManager,
    TabNavigator,
    ScreenHost
};

export { default as ScreenTransition } from "./navigation/ScreenTransition.js";
export { default as TabBar } from "./components/TabBar.js";
export { default as HistorySync } from "./navigation/HistorySync.js";
export { default as SwipeNavigation } from "./navigation/SwipeNavigation.js";

export { isScreenDefinition } from "./navigation/Screen.js";
