import Component from "../core/Component.js";

export default class Row extends Component {
    constructor(props = {}, children = []) {
        super("row", props, children);
    }
}
