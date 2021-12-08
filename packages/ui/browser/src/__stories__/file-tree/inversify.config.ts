import {Container} from 'inversify';
import {FileTree} from './FileTree';
import {types} from './types';

export const dependencyContainer = new Container({
    skipBaseClassChecks: true,
});

dependencyContainer.bind(types.FileTree).to(FileTree).inSingletonScope();

declare global {
    interface HTMLElementTagNameMap {
        'file-tree': FileTree,
    }
}
