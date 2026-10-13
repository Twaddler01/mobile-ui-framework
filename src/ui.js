import createComponent from "./core/createComponent.js";

import ElementComponent from "./components/Element.js";
import TextComponent from "./components/Text.js";
import ButtonComponent from "./components/Button.js";
import CardComponent from "./components/Card.js";
import RowComponent from "./components/Row.js";
import ColumnComponent from "./components/Column.js";

export const Element = createComponent(ElementComponent);
export const Text = createComponent(TextComponent);
export const Button = createComponent(ButtonComponent);
export const Card = createComponent(CardComponent);
export const Row = createComponent(RowComponent);
export const Column = createComponent(ColumnComponent);
