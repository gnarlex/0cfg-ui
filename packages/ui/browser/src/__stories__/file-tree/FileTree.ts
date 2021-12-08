import {injectable} from 'inversify';
import {HtmlComponent, customElement} from '../../ts/HtmlComponent';

@injectable()
@customElement('file-tree')
export class FileTree extends HtmlComponent {
    public constructor() {
        super();
    }

    // TODO
}
