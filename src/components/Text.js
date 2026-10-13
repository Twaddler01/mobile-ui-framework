import Component from "../core/Component.js";

export default class Text extends Component {
    constructor(props = {}, children = []) {
        super(
            "text",
            {
                size: "medium",
                weight: 400,
                align: "left",
                ...props
            },
            children
        );
    }
}
