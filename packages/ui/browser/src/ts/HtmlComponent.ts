import {injectable} from 'inversify';
import {render, noChange, html} from 'lit-html';
import {has} from '@0cfg/utils-common/lib/has';
import {errStatus} from '@0cfg/reply-common/lib/Reply';

/**
 * Export `render` method and a template literal `html` to ensure version consistency and provide an abstraction
 * from lit-html.
 */
export {render, html};

/**
 * A rendering timeout after which a warning will be logged.
 */
const RENDER_TIMEOUT_BEFORE_WARNING: number = 5000;

/**
 * In ms.
 * Don't forget to adjust the corresponging Sass variables as well when changing this constant.
 */
export const ANIMATION_DURATION_SHORT = 100;

/**
 * In ms.
 * Don't forget to adjust the corresponging Sass variables as well when changing this constant.
 */
export const ANIMATION_DURATION_LONG = 300;

export class AlreadyRenderedError extends Error {
    public constructor() {
        super('The component was already rendered. Call .destroy() before rendering again.');
    }
}

export class EmptyContentError extends Error {
    public constructor() {
        super('The HTML content is empty. Nothing to render.');
    }
}

export class UndefinedContainerElementError extends Error {
    public constructor() {
        super('The container element was undefined.');
    }
}

export class SelectorMissedError extends Error {
    public constructor(selector: string) {
        super(`Selector ${selector} points at no dom element.`);
    }
}

export class UnknownLocationError extends Error {
    public constructor(renderLocation: string) {
        super(`Unknown render location ${renderLocation}.`);
    }
}

/**
 * Location in the DOM to which a HtmlComponent can be rendered.
 * Note that a string selector always points to the first element which was found in the DOM/scope.
 * (See https://developer.mozilla.org/de/docs/Web/API/Document/querySelector for more information).
 */
export type HtmlComponentContainer = string | HTMLElement | HtmlComponent;

const validateCustomElementTagName = (tagName: string) => {
    if (tagName.indexOf('-') <= 0) {
        throw new Error('You need at least 1 dash in the custom element name');
    }
};

/**
 * Allow for custom element classes with private constructors.
 */
type CustomElementClass = Omit<typeof HTMLElement, 'new'>;

/**
 * Custom element decorator factory.
 */
export const customElement = (tagName: string) => (class_: CustomElementClass) => {
    validateCustomElementTagName(tagName);
    window.customElements.define(tagName, class_ as CustomElementConstructor);
};

/**
 * Manages the lifecycle of a single custom HTML element.
 */
@injectable()
export class HtmlComponent extends HTMLElement {

    /**
     * Intended to be overridden by subclasses.
     * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/style
     */
    protected readonly styles?: string;

    /**
     * Quite convenient for debugging, however this could be done with a watch expression as well
     */
    protected readonly type = this.constructor.name;

    protected renderedOnce: boolean = false;

    private readonly visibilityChangeListeners: Set<((visible: boolean) => unknown)> =
        new Set<((visible: boolean) => unknown)>();

    /**
     * Initialized to {@code false} because this component is not rendered yet.
     */
    private visibilityState: boolean = false;

    private hideWhenRendered: boolean = false;

    /**
     * @returns An array containing the names of the attributes you want to observe. These attributes are being used
     * to pass values to the custom element.
     */
    public static get observedAttributes(): string[] { return []; }

    /**
     * Constructor is intended for override but no direct usage.
     *
     * The constructor should be used to set up initial state and default values, and to set up event
     * listeners and a shadow root.
     *
     * To read all of the requirements for custom element constructors and reactions
     * @see https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-conformance
     */
    protected constructor() {
        super();

        // Create a shadow root.
        this.attachShadow({mode: 'open'});
    }

    /**
     * Triggered when this element is connected to the DOM.
     */
    public async connectedCallback(): Promise<void> {
        /**
         * Ensure that the element is connected.
         * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks
         */
        if (!this.isConnected) return;

        console.log('Element connected');

        const renderStart = Date.now();

        if (!this.renderedOnce) {
            this.renderedOnce = true;
            await this.beforeFirstRender();
        }
        await this.beforeEveryRender();

        // Attach HTML content of this element to the DOM.
        render(this.render(), this.shadowRoot!);
        this.updateStyles();

        this.afterEveryRender();

        this.isVisible() && this.fireVisibilityChange(this.isVisible());

        if (this.hideWhenRendered) {
            this.hide();
        } else {
            this.visibilityState = true;
        }

        if ((Date.now() - renderStart) > RENDER_TIMEOUT_BEFORE_WARNING) {
            errStatus(`Component render took more than ${RENDER_TIMEOUT_BEFORE_WARNING} seconds.`).log();
        }
    }

    /**
     * Triggered when this element is disconnected from the DOM.
     */
    public disconnectedCallback(): void {
        console.log('Element disconnected');
    }

    /**
     * Triggered when an atribute that we observe {@link observedAttributes} has been changed.
     */
    public attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown): void {
        console.log('Attribute changed', name, oldValue, newValue);
        // TODO (@romfrolov) Handle changed attribute.
    }

    /**
     * @param fadeOut If {@code true}, the html element will get the being-destroyed class added for a short duration
     * before being removed from the DOM. The exact duration is {@link ANIMATION_DURATION_SHORT} milliseconds.
     *
     * The method will return once the element is fully removed from the DOM.
     */
    public destroy(fadeOut: boolean = false): Promise<void> {
        const doDestroy: () => Promise<void> = async () => {
            if (this.isConnected) {
                this.remove();
            }
            this.fireVisibilityChange(false);
        };

        if (fadeOut) {
            return new Promise<void>(resolve => {
                if (this.isConnected) {
                    this.classList.add('being-destroyed');
                }
                setTimeout(async () => {
                    await doDestroy();
                    resolve();
                }, ANIMATION_DURATION_SHORT);
            });
        }

        return doDestroy();
    }

    /**
     * Find the first dom element inside this component matching the {@param selector}.
     * If no element is found, an error is thrown.
     * An error is also thrown if the html component is not rendered yet.
     */
    public findInScope<T extends HTMLElement>(selector: string): T {
        const result = this.findAllInScope(selector);
        if (!has(result) || result.length === 0) {
            throw new Error(`Element not found ${selector}`);
        }
        return result[0] as T;
    }

    /**
     * Find all DOM elements inside this component matching the {@param selector}
     * If no elements are found, an empty array is returned.
     *
     * An error is thrown if the html component is not rendered yet.
     */
    public findAllInScope(selector: string): HTMLElement[] {
        return Array.from(this.shadowRoot!.querySelectorAll(selector));
    }

    /**
     * Whether this component is currently connected to the DOM.
     * @alias isConnected
     */
    public isRendered(): boolean {
        return this.isConnected;
    }

    /**
     * Sets the tooltip of this HtmlComponent.
     *
     * Technically speaking the tooltip is the title property of the HTML
     * element.
     *
     * The element must be render to the dom first otherwise this method does
     * nothing {@see HtmlComponent#connectedCallback}.
     *
     * @param tooltip The tooltip text to be displayed when hovering over this HtmlComponent.
     */
    public setTooltip(tooltip: string): void {
        if (has(this)) {
            this.setAttribute('title', tooltip);
        }
    }

    public isVisible(): boolean {
        return this.visibilityState;
    }

    /**
     * Show (not copy) this component in the DOM.
     */
    public show(): void {
        if (this.isRendered()) {
            // NOTE (@romfrolov) That is opinionated.
            // this.classList.remove('hidden');
            this.hidden = false;
            this.visibilityState = true;
            this.fireVisibilityChange(this.isVisible());
        }
    }

    /**
     * Hide (not remove) this component in the DOM.
     */
    public hide(): void {
        if (this.isRendered()) {
            // NOTE (@romfrolov) That is opinionated.
            // this.classList.add('hidden');
            this.hidden = true;
            this.visibilityState = false;
            this.fireVisibilityChange(this.isVisible());
        } else {
            this.hideWhenRendered = true;
        }
    }

    /**
     * Renders the HTML content of this element.
     *
     * Intended to be overridden by subclasses.
     */
    protected render(): unknown {
        return noChange;
    }

    /**
     * Override this to do things before the first rendering run.
     * This method is called only once per instance.
     * This default implementation does nothing.
     */
    protected async beforeFirstRender(): Promise<void> {
        // Do nothing here.
    }

    /**
     * Override this to do things before rendering.
     * This default implementation does nothing.
     */
    protected async beforeEveryRender(): Promise<void> {
        // Do nothing here.
    }

    /**
     * Override this to do things after rendering.
     * This default implementation does nothing.
     */
    protected async afterEveryRender(): Promise<void> {
        // Do nothing here.
    }

    /**
     * Will inform all listeners of a visibility state change.
     * Will remember the old state and only fire if the state changes.
     */
    protected fireVisibilityChange(visible: boolean): void {
        this.visibilityChangeListeners.forEach(listener => listener(visible));
        this.visibilityState = visible;
    }

    private updateStyles(): void {
        if (!has(this.styles)) return;

        const style = document.createElement('style');
        style.textContent = this.styles;

        const shadow = this.shadowRoot!;
        shadow.appendChild(style);
    }
}
