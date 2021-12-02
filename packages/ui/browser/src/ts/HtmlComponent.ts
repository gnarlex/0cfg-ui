import {injectable} from 'inversify';
import {render, noChange, html, svg} from 'lit-html';
import {has} from '@0cfg/utils-common/lib/has';
import {errStatus} from '@0cfg/reply-common/lib/Reply';

/**
 * Export `render` method and template literals to ensure version consistency and provide an abstraction from lit-html.
 */
export {render, html, svg};

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

/**
 * @see https://html.spec.whatwg.org/#valid-custom-element-name
 */
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
export const customElement = (tagName: string) => (customElementClass: CustomElementClass) => {
    validateCustomElementTagName(tagName);
    window.customElements.define(tagName, customElementClass as CustomElementConstructor);
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
     * Invoked when this element is connected to the DOM.
     */
    public connectedCallback(): void {
        /**
         * Ensure that the element is connected.
         *
         * eslint-disable-next-line
         * @see https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks
         */
        if (!this.isConnected) return;

        this._render();
    }

    /**
     * Invoked when this element is disconnected from the DOM.
     */
    public disconnectedCallback(): void {
        // Override to handle the disconnect event.
    }

    /**
     * Invoked each time the custom element is moved to a new document.
     */
    public adoptedCallback(): void {
        // Override to handle the adopted event.
    }

    /**
     * Invoked when an atribute that we observe {@link observedAttributes} has been changed.
     */
    public attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown): void {
        // Override to handle a changed attribute.
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
     * Check whether a DOM element matching the {@param selector} exists inside of this component.
     *
     * Always returns false if the HTML component is not rendered yet.
     */
    public hasInScope(selector: string): boolean {
        const result = this.findAllInScope(selector);

        return (result.length > 0);
    }

    /**
     * Find the first DOM element inside this component matching the {@param selector}.
     * If no element is found, an error is thrown.
     *
     * An error is also thrown if the HTML component is not rendered yet.
     */
    public findInScope<T extends HTMLElement>(selector: string): T {
        const result = this.findAllInScope(selector);

        if (result.length === 0) {
            throw new Error(`Element not found ${selector}`);
        }

        return result[0] as T;
    }

    /**
     * Find all DOM elements inside this component matching the {@param selector}
     * If no elements are found, an empty array is returned.
     *
     * An error is thrown if the HTML component is not rendered yet.
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
        // REVIEW (@romfrolov)
        this.setAttribute('title', tooltip);
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
     * Updates the HTML content by rerendering it. Only rerenders the content of the current component, doesn't affect
     * child components.
     */
    public update(): void {
        this._render();
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
     * Override this to do things after the first rendering run.
     * This method is called only once per instance.
     * This default implementation does nothing.
     */
    protected async afterFirstRender(): Promise<void> {
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

    /**
     * Renders inner HTML of the component.
     */
    private async _render(): Promise<void> {
        const isFirstRender = !this.renderedOnce;

        const renderStart = Date.now();

        if (isFirstRender) {
            this.renderedOnce = true;
            await this.beforeFirstRender();
        }
        await this.beforeEveryRender();

        // Attach HTML content of this element to the DOM.
        render(this.render(), this.shadowRoot!);
        this._updateStyles();

        if (isFirstRender) {
            this.afterFirstRender();
        }
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
     * Updates styles. Will update the style element if it already exists, otherwise will create a new style element and
     * append it to the shadow root.
     */
    private _updateStyles(): void {
        if (!has(this.styles)) return;

        const shadow = this.shadowRoot!;

        const style = shadow.querySelector('style');

        if (has(style)) {
            if (style.textContent === this.styles) return;

            style.textContent = this.styles;
            return;
        }

        const newStyle = document.createElement('style');
        newStyle.textContent = this.styles;
        shadow.appendChild(newStyle);
    }
}
