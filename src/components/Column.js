import Component from "../core/Component.js";

export default class Column extends Component {
    constructor(props = {}, children = []) {
        super("column", props, children);
    }
}
