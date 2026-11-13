import { Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import Modal from "./Modal";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/*
 * Promise-based replacement for window.confirm:
 * `if (await confirm({...})) { ... }`
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((nextOptions) => {
    setOptions(nextOptions);

    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Modal
        open={Boolean(options)}
        onClose={() => close(false)}
        title={options?.title || ""}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => close(false)}
              className="btn-ghost"
            >
              Cancel
            </button>

            <button
              type="button"
              autoFocus
              onClick={() => close(true)}
              className={options?.destructive ? "btn-danger" : "btn-primary"}
            >
              {options?.confirmLabel}
            </button>
          </>
        }
      >
        {options?.description && (
          <p className="px-5 py-4 text-sm leading-relaxed text-zinc-400">
            {options.description}
          </p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }

  return context;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />;
}
