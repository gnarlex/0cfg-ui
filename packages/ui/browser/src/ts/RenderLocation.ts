export enum RenderLocation {
    /**
     * Render into the selected element, as last child
     */
    IntoEnd,
    /**
     * Render into the selected element, as first child
     */
    IntoBeginning,
    /**
     * Render just before the selected element, as preceding sibling
     */
    Before,
    /**
     * Render just after the selected element, as succeeding sibling
     */
    After
}