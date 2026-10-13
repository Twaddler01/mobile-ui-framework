import Component from "../core/Component.js";

export default class Button extends Component {
    constructor(props = {}, children = []) {
        super(
            "button",
            {
                variant: "primary",
                size: "medium",
                disabled: false,
                type: "button",
                ...props
            },
            children
        );
    }
}
