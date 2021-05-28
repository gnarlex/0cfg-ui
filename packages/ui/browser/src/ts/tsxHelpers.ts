import {has} from '@0cfg/utils-common/lib/has';
import {definedKeys} from '@0cfg/utils-common/lib/definedKeys';

class ReactClass {
    public createElement(elementName: string, attributes: any, ...children: string[]): string {
        return `<${elementName} ${objectToAttributes(attributes)}>${childrenToString(children)}</${elementName}>`;
    }
}

const objectToAttributes = (obj: Record<string, string>) => has(obj) ?
    definedKeys(obj).map((key: string) => `${key}="${obj[key]}"`).join('') : '';

const childrenToString = (children: string[]) => has(children) ? children.join('') : '';

/**
 * Fake react export to allow .tsx with minimal footprint.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const React = new ReactClass();
