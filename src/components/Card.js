import Component from "../core/Component.js";

export default class Card extends Component {
    constructor(props = {}, children = []) {
        super("card", props, children);
    }
}
