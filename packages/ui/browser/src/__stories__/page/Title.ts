import {injectable} from 'inversify';

@injectable()
export class Title {
    public innerText: string = 'Title';
}
