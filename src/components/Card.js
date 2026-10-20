import Component from "../core/Component.js";
import ElementComponent from "./Element.js";

export default class Card extends Component {
    constructor(props = {}, children = []) {
        const { heading, description, ...rest } = props;
        const kids = [];

        if (heading) {
            kids.push(new ElementComponent({ tagName: "h2" }, [heading]));
        }
        if (description) {
            kids.push(new ElementComponent({ tagName: "p" }, [description]));
        }
        kids.push(...children);

        super("card", rest, kids);
    }
}