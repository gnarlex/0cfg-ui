import {injectable, inject} from 'inversify';
import {HtmlComponent, customElement, html} from '../../ts/HtmlComponent';
import {types} from './types';
import './InputForm';
import './MainList';

import './main-page.css';

@injectable()
@customElement('main-page')
export class MainPage extends HtmlComponent {
    @inject(types.MainHeader) private header: HTMLElementTagNameMap['main-header'];

    public constructor() {
        super();
    }

    public render(): unknown {
        return html`
            <style>
                .hidden {
                    display: none;
                }
            </style>
            ${this.header}
            <input-form .handleSubmit=${(text: string) => this.handleSubmit(text)}></input-form>
            <main-list>
                <p>Light DOM node 1</p>
                <p>Light DOM node 2</p>
            </main-list>
        `;
    }

    private handleSubmit(text: string): void {
        if (text === '') return;
        this.findInScope<HTMLElementTagNameMap['main-list']>('main-list').add(text);
    }
}
