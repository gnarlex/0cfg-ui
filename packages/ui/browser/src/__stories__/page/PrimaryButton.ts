import {HtmlComponent, customElement, html} from '../../ts/HtmlComponent';

@customElement('primary-button')
class PrimaryButton extends HtmlComponent {
    private label: string = 'Label';
    private handleSubmit?: () => void;
    private disabled?: boolean;

    protected styles: string = `
        button {
            background-color: blue;
            color: white;
        }

        button:hover {
            cursor: pointer;
        }
    `;

    public render(): unknown {
        return html`
            <button
                type='button'
                @click=${this.handleSubmit}
                ?disabled=${this.disabled}
            >
                ${this.label}
            </button>
        `;
    }
}
