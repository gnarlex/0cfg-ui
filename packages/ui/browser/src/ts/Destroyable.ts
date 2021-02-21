/**
 * IDestroyable is a resource that needs to be destroyed.
 * If the destroyable is never destroyed unexpected program behaviour can
 * occur.
 * Destroybale things can be streams, components or anything else that needs to
 * be destroyed.
 */
export interface Destroyable {
    /**
     * Destroys the object and waits for it's destruction.
     */
    destroy(): Promise<void>;
}