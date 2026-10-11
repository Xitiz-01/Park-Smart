import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ConfirmContext = createContext(null);

// Replaces window.confirm with an accessible dialog (focus trap, Escape, focus
// returns to the trigger). Call sites stay one line:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Cancel this booking?', confirmLabel: 'Cancel booking', tone: 'danger' }))) return;
//
// tone: 'danger' for destructive actions, 'default' otherwise.
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);
  // The dialog opens from a promise, not a Radix trigger, so remember what had
  // focus and hand it back on close.
  const returnFocusTo = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    returnFocusTo.current = document.activeElement;
    setRequest({ cancelLabel: 'Keep it', confirmLabel: 'Confirm', tone: 'default', ...options });
  }), []);

  const settle = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(request)} onOpenChange={(open) => { if (!open) settle(false); }}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocusTo.current?.isConnected) returnFocusTo.current.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg">{request?.title}</AlertDialogTitle>
            {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{request?.cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              variant={request?.tone === 'danger' ? 'destructive' : 'default'}
              onClick={() => settle(true)}
            >
              {request?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
}
