export default interface IToast {
    id: number;
    message: string;
    level?: string;
    duration?: number; // In seconds.
}
