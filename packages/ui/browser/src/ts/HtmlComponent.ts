import {injectable} from 'inversify';
import {render, TemplateResult} from 'lit-html';
import {randomString} from '@0cfg/utils-common/lib/randomString';
import {has} from '@0cfg/utils-common/lib/has';
import {errStatus} from '@0cfg/reply-common/lib/Reply';
import {RenderLocation} from './RenderLocation';

const timeoutBeforeWarning: number = 5000;

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

/**
 * In ms.
 * Don't forget to adjust the corresponging sass variables as well when changing this constant.
 */
export const animationDurationShort = 100;

/**
 * In ms.
 * Don't forget to adjust the corresponging sass variables as well when changing this constant.
 */
export const animationDurationLong = 300;

/**
 * Manages the lifecycle of a single html div element.
 * The div element can contain other arbitrary elements.
 * Those elements are either defined in the constructor by setting htmlContent
 * or by adding them dynamically in the {@link renderTo} method.
 */
@injectable()
export class HtmlComponent {

    private parent_?: HtmlComponent;

    private readonly visibilityChangeListeners: Set<((visible: boolean) => unknown)> =
        new Set<((visible: boolean) => unknown)>();

    /**
     * Initialized to {@code false} because this component is not rendered yet.
     */
    private visibilityState: boolean = false;
    /**
     * Set on render in {@link renderTo}.
     * Set to undefined in {@link destroy}.
     */
    private element?: HTMLElement;
    private hideWhenRendered: boolean = false;

    /**
     * Intended to be overridden by subclasses.
     * See: https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML
     */
    protected readonly htmlContent?: TemplateResult;

    /**
     * Intended to be overridden by subclasses.
     * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/class
     */
    protected readonly classAttr?: string;

    /**
     * Intended to be overridden by subclasses.
     * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/style
     */
    protected readonly styleAttr?: string

    /**
     * this component instance id, will be added as a class to our root.
     */
    protected readonly id = '_c_' + randomString();

    /**
     * Quite convenient for debugging, however this could be done with a watch expression as well
     */
    protected readonly type = this.constructor.name;
    protected renderedOnce: boolean = false;

    /**
     * Constructor intended for override but no direct usage.
     * Refer to {@link HtmlComponent.create()} to create HtmlComponents directly.
     */
    protected constructor() {
    }

    public static create(htmlContent?: TemplateResult, classAttr?: string, styleAttr?: string): HtmlComponent {
        const result: HtmlComponent = new class extends HtmlComponent {
            protected readonly htmlContent?: TemplateResult = htmlContent;
            protected readonly classAttr?: string = classAttr;
            protected readonly styleAttr?: string = styleAttr;
        };
        return result;
    }

    protected set parent(parent: HtmlComponent | undefined) {
        this.parent_ = parent;
        if (has(this.parent) && this.visibilityChangeListeners.size > 0) {
            this.parent.onVisibilityChange(this.myParentVisibilityListener);
        }
    }

    protected get parent(): HtmlComponent | undefined {
        return this.parent_;
    }

    /**
     * Set the parent component of this component in order to propagate visibility changes bidirectionally.
     */
    public setParent(parent: HtmlComponent | undefined): this {
        this.parent = parent;
        return this;
    }

    /**
     * Get HTML content without a wrapper.
     *
     * QUESTION (@romfrolov) How to make it work with findInScope and hooks?
     */
    public render(): TemplateResult {
        if (!has(this.htmlContent)) throw new EmptyContentError();

        return this.htmlContent;
    }

    /**
     * Renders to a {@link HtmlComponentContainer}.
     */
    public async renderTo(
        container: HtmlComponentContainer,
        renderLocation = RenderLocation.IntoEnd
    ): Promise<this> {

        const renderStart = Date.now();

        if (!has(container)) {
            throw new UndefinedContainerElementError();
        }
        if (this.isRendered()) {
            throw new AlreadyRenderedError();
        }
        if (!this.renderedOnce) {
            this.renderedOnce = true;
            await this.beforeFirstRender();
        }
        await this.beforeEveryRender();

        this.createElementAndApplyAttributes()
            .renderToTargetAndLocation(renderLocation, HtmlComponent.getRenderTarget(container));

        await this.afterEveryRenderSync();
        this.afterEveryRender();

        this.isVisible() &&
        this.fireVisibilityChange(this.isVisible());

        if (this.hideWhenRendered) {
            this.hide();
        } else {
            this.visibilityState = true;
        }

        if ((Date.now() - renderStart) > timeoutBeforeWarning) {
            errStatus(`Component render took more than ${timeoutBeforeWarning} seconds.`).log();
        }
        return this;
    }

    private renderToTargetAndLocation(
        renderLocation: RenderLocation,
        renderTarget: HTMLElement,
    ): this {
        const parentNode = renderTarget.parentNode;
        switch (renderLocation) {
            case RenderLocation.IntoBeginning:
                renderTarget.prepend(this.element!);
                break;
            case RenderLocation.Before:
                if (has(parentNode)) {
                    parentNode.insertBefore(this.element!, renderTarget);
                } else {
                    document.insertBefore(this.element!, renderTarget);
                }
                break;
            case RenderLocation.After:
                if (has(parentNode)) {
                    parentNode.insertBefore(this.element!, renderTarget.nextSibling);
                } else {
                    document.insertBefore(this.element!, renderTarget.nextSibling);
                }
                break;
            case RenderLocation.IntoEnd:
                renderTarget.append(this.element!);
                break;
            default:
                this.element = undefined;
                throw new UnknownLocationError(renderLocation);
        }
        return this;
    }

    private createElementAndApplyAttributes(): this {
        this.element = document.createElement('div');
        if (has(this.htmlContent)) {
            render(this.htmlContent, this.element);
        }
        if (has(this.classAttr)) {
            this.element.setAttribute('class', this.classAttr);
        }
        this.element.classList.add(this.id);
        if (has(this.styleAttr)) {
            this.element.setAttribute('style', this.styleAttr);
        }
        return this;
    }

    private static getRenderTarget(container: HtmlComponentContainer): HTMLElement {
        if (typeof container === 'string') {
            const renderTarget = document.querySelector(container);
            if (!has(renderTarget)) {
                throw new SelectorMissedError(container);
            }
            return <HTMLElement>renderTarget;
        }
        return 'getRootElement' in container ? container.getRootElement() : container;
    }

    /**
     * @param fadeOut If {@code true}, the html element will get the being-destroyed class added for a short duration
     *              before being removed from the dom.
     *              The exact duration is {@link animationDurationShort} milliseconds.
     *              The method will still only return once the element is fully removed from the dom.
     */
    public destroy(fadeOut: boolean = false): Promise<void> {
        // do not substitute has(this.element) with this.isRendered() here - subclasses may override this.isRendered
        const doDestroy: () => Promise<void> = async () => {
            if (has(this.element)) {
                this.element.remove();
            }
            delete this.element;
            this.fireVisibilityChange(false);
        };
        if (fadeOut) {
            return new Promise<void>(resolve => {
                if (has(this.element)) {
                    this.element.classList.add('being-destroyed');
                }
                setTimeout(async () => {
                    await doDestroy();
                    resolve();
                }, animationDurationShort);
            });
        } else {
            return doDestroy();
        }
    }

    /**
     * Find the first dom element inside this component matching the {@param selector}.
     * If no element is found, an error is thrown.
     * An error is also thrown if the html component is not rendered yet.
     */
    public findInScope<T extends HTMLElement>(selector: string): T {
        // do not substitute has(this.element) with this.isRendered() here - subclasses may override this.isRendered
        if (!has(this.element)) {
            throw new Error('findInScope called on an unrendered html component.');
        }

        const result = this.findAllInScope(selector);
        if (!has(result) || result.length === 0) {
            throw new Error(`Element not found ${selector}`);
        }
        return result[0] as T;
    }

    /**
     * Find all dom elements inside this component matching the {@param selector}
     * If no element is found, an empty array is returned.
     *
     * An error is thrown if the html component is not rendered yet.
     */
    public findAllInScope(selector: string): HTMLElement[] {
        // do not substitute has(this.element) with this.isRendered() here - subclasses may override this.isRendered
        if (!has(this.element)) {
            throw new Error('findAllInScope called on an unrendered html component.');
        }

        return Array.from(this.element.querySelectorAll(selector));
    }

    /**
     * If this component is currently rendered.
     */
    public isRendered(): boolean {
        return has(this.element);
    }

    /**
     * Sets or overwrites the tooltip of this HtmlComponent.
     * Technically speaking the tooltip is the title property of the Html
     * element.
     * The element must be render to the dom first otherwise this method does
     * nothing {@see HtmlComponent#renderTo}.
     * @param tooltip The tooltip to be displayed when hovering over this
     *     HtmlComponent
     */
    public setTooltip(tooltip: string): void {
        if (has(this.element)) {
            this.element.setAttribute('title', tooltip);
        }
    }

    /**
     * Attaches a listener which is invoked after a visibility change (hidden or shown).
     */
    public onVisibilityChange(listener: (visible: boolean) => unknown): void {
        this.visibilityChangeListeners.add(listener);
        if (has(this.parent) && this.visibilityChangeListeners.size === 1) {
            // the first listener that we have. we also register at the parent then
            this.parent.onVisibilityChange(this.myParentVisibilityListener);
        }
    }

    /**
     * Removes a visibility change listener.
     */
    public removeVisibilityChangeListener(listener: (visible: boolean) => unknown): void {
        this.visibilityChangeListeners.delete(listener);
        if (has(this.parent) && this.visibilityChangeListeners.size === 0) {
            // deregister from the parent as we are not interested in visibility changes
            // anymore
            this.parent.removeVisibilityChangeListener(this.myParentVisibilityListener);
        }
    }

    public isVisible(): boolean {
        return this.visibilityState && (!has(this.parent) || this.parent.isVisible());
    }

    /**
     * Show (not copy) this component in the DOM.
     */
    public show(): void {
        if (this.isRendered()) {
            this.element?.classList.remove('hidden');
            this.visibilityState = true;
            this.fireVisibilityChange(this.isVisible());
        }
    }

    /**
     * Hide (not remove) this component in the DOM.
     */
    public hide(): void {
        if (this.isRendered()) {
            this.element?.classList.add('hidden');
            this.visibilityState = false;
            this.fireVisibilityChange(this.isVisible());
        } else {
            this.hideWhenRendered = true;
        }
    }

    /**
     * Override this to do things before the first rendering run.
     * This method is called only once per instance.
     * This default implementation does nothing.
     */
    protected async beforeFirstRender(): Promise<void> {
        // do nothing here
    }

    /**
     * Override this to do things before rendering.
     * This default implementation does nothing.
     */
    protected async beforeEveryRender(): Promise<void> {
        // do nothing here
    }

    /**
     * Override this to do things after rendering.
     * This default implementation does nothing.
     */
    protected async afterEveryRender(): Promise<void> {
        // do nothing here
    }

    /**
     * Override this to do things synchronously after rendering.
     * This default implementation does nothing.
     * Note that this can block the node process and should be used with caution.
     */
    protected afterEveryRenderSync(): void {
        // do nothing here
    }

    /**
     * This throws function an error if the HtmlComponent is not rendered.
     */
    protected getRootElement(): HTMLElement {
        if (!has(this.element)) {
            throw new Error('Called getRootElement on an unrendered HtmlComponent.');
        }
        return this.element;
    }

    /**
     * overwrite this if you want to do something like mind your own visibility state (see HideableHtmlComponent)
     * @param visible
     */
    protected parentVisibilityChanged(visible: boolean): void {
        this.fireVisibilityChange(visible);
    }

    /**
     * Will inform all listeners of a visibility state change.
     * will remember the old state and only fire if the state changes
     * @param visible
     */
    protected fireVisibilityChange(visible: boolean): void {
        this.visibilityChangeListeners.forEach(listener => listener(visible));
        this.visibilityState = visible;
    }

    private myParentVisibilityListener = (visible: boolean): void => this.parentVisibilityChanged(visible);
}
