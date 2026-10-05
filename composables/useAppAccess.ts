/**
 * The closed-beta gate. app.vue mounts the app only once this says the
 * visitor has access, so nothing behind the gate is in the page until then:
 * removing the gate's element leaves an empty screen, not the app.
 *
 * Only the password's SHA-256 is shipped, and the same hash is what a
 * visitor who got in keeps in their browser. A static site has no server to
 * check against, so this keeps the app out of casual reach; it is not
 * access control for anything secret.
 */
const ACCESS_HASH = "c236d10aa53ffdb8f7234bbdc72fb6ca9ca6d06a6bff740ed3cf51375db68e3a";
const STORAGE_KEY = "rethink_app_access";

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: ask for the password again.
    return null;
  }
};

const sha256 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const useAppAccess = () => {
  // The app renders client-side only (ssr: false), so storage can be read
  // before the first render and a visitor with access never sees the gate.
  const hasAccess = useState("app-access", () => readStored() === ACCESS_HASH);

  /** Lets the visitor in if `password` is right; says whether it was. */
  const unlock = async (password: string): Promise<boolean> => {
    if ((await sha256(password)) !== ACCESS_HASH) return false;
    try {
      localStorage.setItem(STORAGE_KEY, ACCESS_HASH);
    } catch {
      // Not remembered, but this visit still gets in.
    }
    hasAccess.value = true;
    return true;
  };

  return { hasAccess, unlock };
};
