import {HtmlComponent, customElement, html} from '../../ts/HtmlComponent';
import './PrimaryButton';

@customElement('input-form')
class InputForm extends HtmlComponent {
    private handleSubmit?: (text: string) => void;
    private showButton: boolean = false;

    protected styles: string = `
        input {
            color: var(--blue);
        }
    `;

    public render(): unknown {
        return html`
            <input
                type='text'
                placeholder='Type something...'
                @input=${() => {
                    const text = this.findInScope<HTMLInputElement>('input').value;
                    this.showButton = (text.length > 0);
                    this.update();
                }}
            >
            ${this.showButton
                ? html`
                    <primary-button
                        .handleSubmit=${() => this.handleSubmit(this.getInput())}
                        .label=${'Submit'}
                    ></primary-button>
                `
                : html``}
        `;
    }

    private getInput(): string {
        const text = this.findInScope<HTMLInputElement>('input').value;

        this.findInScope<HTMLInputElement>('input').value = '';
        this.showButton = false;
        this.update();

        return text;
    }

    protected async afterEveryRender(): Promise<void> {
        this.hide();
        this.show();
        this.setTooltip('tooltip');
    }
}
