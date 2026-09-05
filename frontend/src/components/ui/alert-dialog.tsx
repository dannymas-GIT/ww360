import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface AlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface AlertDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogActionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface AlertDialogCancelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const AlertDialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

const AlertDialog: React.FC<AlertDialogProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [onOpenChange]
  );

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>{children}</AlertDialogContext.Provider>
  );
};

const AlertDialogTrigger: React.FC<AlertDialogTriggerProps> = ({ children, className }) => {
  const { setOpen } = React.useContext(AlertDialogContext);

  return (
    <div className={className} onClick={() => setOpen(true)}>
      {children}
    </div>
  );
};

const AlertDialogContent: React.FC<AlertDialogContentProps> = ({ children, className }) => {
  const { open, setOpen: _setOpen } = React.useContext(AlertDialogContext);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div
        className={cn(
          'relative w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:p-6',
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const AlertDialogHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('mb-4 text-center sm:text-left', className)}>{children}</div>;

const AlertDialogTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>;

const AlertDialogDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <p className={cn('mt-2 text-sm text-gray-500', className)}>{children}</p>;

const AlertDialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('mt-4 flex justify-end space-x-2', className)}>{children}</div>;

const AlertDialogAction: React.FC<AlertDialogActionProps> = ({ children, className, onClick }) => {
  const { setOpen } = React.useContext(AlertDialogContext);

  const handleClick = () => {
    onClick?.();
    setOpen(false);
  };

  return (
    <Button className={cn('bg-red-600 hover:bg-red-700', className)} onClick={handleClick}>
      {children}
    </Button>
  );
};

const AlertDialogCancel: React.FC<AlertDialogCancelProps> = ({ children, className, onClick }) => {
  const { setOpen } = React.useContext(AlertDialogContext);

  const handleClick = () => {
    onClick?.();
    setOpen(false);
  };

  return (
    <Button variant="outline" className={className} onClick={handleClick}>
      {children}
    </Button>
  );
};

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
