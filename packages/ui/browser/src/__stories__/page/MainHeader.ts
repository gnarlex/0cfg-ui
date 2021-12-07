import {injectable, inject} from 'inversify';
import {HtmlComponent, customElement, html} from '../../ts/HtmlComponent';
import {types} from './types';
import {Title} from './Title';

@injectable()
@customElement('main-header')
export class MainHeader extends HtmlComponent {
    private readonly titleText: string;

    public constructor(
        @inject(types.Title) title: Title,
    ) {
        super();

        this.titleText = title.innerText;
    }

    public render(): unknown {
        return html`
            <header>
                <h1>${this.titleText}</h1>
                <hr>
            </header>
        `;
    }
}
