import {HtmlComponent, customElement, html} from '../../ts/HtmlComponent';

@customElement('main-list')
class MainList extends HtmlComponent {
    public render(): unknown {
        return html`
            <ul>

            </ul>
            <strong>Slots example:</strong>
            <slot>

            </slot>
        `;
    }

    public add(text: string): void {
        const li = document.createElement('li');
        li.innerText = text;
        this.findInScope('ul').appendChild(li);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'main-list': MainList,
    }
}
