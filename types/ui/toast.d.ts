export default interface IToast {
    id: number;
    message: string;
    level?: string;
    duration?: number; // In seconds.
    /**
     * An optional call to action rendered after the message. For errors the
     * reader can actually resolve, where naming the fix beats describing it.
     */
    link?: IToastLink;
}

export interface IToastLink {
    url: string;
    label: string;
}
