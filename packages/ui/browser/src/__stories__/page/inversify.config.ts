import {Container} from 'inversify';
import {Title} from './Title';
import {MainHeader} from './/MainHeader';
import {MainPage} from './MainPage';
import {types} from './types';

export const dependencyContainer = new Container({
    skipBaseClassChecks: true,
});

dependencyContainer.bind(types.Title).to(Title).inSingletonScope();
dependencyContainer.bind(types.MainHeader).to(MainHeader).inSingletonScope();
dependencyContainer.bind(types.MainPage).to(MainPage).inSingletonScope();

declare global {
    interface HTMLElementTagNameMap {
        'main-header': MainHeader,
    }
}
