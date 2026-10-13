import Component from "../core/Component.js";

export default class Element extends Component {
    constructor(props = {}, children = []) {
        super(
            "element",
            {
                tagName: "div",
                ...props
            },
            children
        );
    }
}
