// contexts/AlertContext.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/atoms/alert-dialog';
import { Label } from '@/components/atoms/label';
import { cn } from '@/lib/utils';

export interface AlertOptions {
  title: string;
  description?: string;
  // 설명 아래 한 줄 띄우고 빨간색으로 보여 줄 주의 문구
  warning?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

/** confirm + input */
export interface ConfirmWithInputOptions extends AlertOptions {
  input?: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    maxLength?: number;
  };
}

export type ConfirmWithInputResult = { confirmed: true; value: string } | { confirmed: false };

interface AlertContextType {
  confirm: (options: AlertOptions) => Promise<boolean>;
  confirmWithInput: (options: ConfirmWithInputOptions) => Promise<ConfirmWithInputResult>;
  alert: (options: Omit<AlertOptions, 'cancelText'>) => Promise<void>;
}

type ResolverValue = boolean | ConfirmWithInputResult;
const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmWithInputOptions>({
    title: '',
    description: '',
    confirmText: '확인',
    cancelText: '취소',
    variant: 'default',
  });
  const [resolver, setResolver] = useState<((value: ResolverValue) => void) | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  const hasInput = !!config.input;
  const maxLen = config.input?.maxLength || 100;

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setInputError('');
    }
  }, [isOpen]);

  const confirm = useCallback((options: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig({
        confirmText: '확인',
        cancelText: '취소',
        variant: 'default',
        ...options,
        input: undefined,
      });
      setResolver(() => resolve as (v: ResolverValue) => void);
      setIsOpen(true);
    });
  }, []);

  const confirmWithInput = useCallback(
    (options: ConfirmWithInputOptions): Promise<ConfirmWithInputResult> => {
      return new Promise((resolve) => {
        setConfig({
          confirmText: '확인',
          cancelText: '취소',
          variant: 'default',
          ...options,
        });
        setResolver(() => resolve);
        setIsOpen(true);
      });
    },
    [],
  );

  const alert = useCallback((options: Omit<AlertOptions, 'cancelText'>): Promise<void> => {
    return new Promise((resolve) => {
      setConfig({
        confirmText: '확인',
        variant: 'default',
        ...options,
        cancelText: undefined,
        input: undefined,
      });
      setResolver(() => resolve as unknown as (v: ResolverValue) => void);
      setIsOpen(true);
    });
  }, []);

  // 인풋 타입인 경우 입력 검증
  function validateInput(trimmedVal: string) {
    if (config.input?.required && trimmedVal.length === 0) {
      setInputError(`${config?.input?.label}을(를) 입력해 주세요.`);
      return false;
    }
    if (trimmedVal.length > maxLen) {
      setInputError(`${maxLen}자 이내로 입력해 주세요.`);
      return false;
    }
    return true;
  }

  function handleConfirm(e?: React.MouseEvent) {
    if (hasInput) {
      const trimmed = inputValue.trim();
      const result = validateInput(trimmed);
      if (!result) {
        // 모달 닫힘 방지
        e?.preventDefault();
        e?.stopPropagation();
        return;
      }
      resolver?.({ confirmed: true, value: trimmed });
    } else {
      resolver?.(true);
    }

    setIsOpen(false);
    setResolver(null);
  }

  function handleCancel() {
    const resolve = (hasInput ? { confirmed: false } : false) as ResolverValue;
    resolver?.(resolve);

    setIsOpen(false);
    setResolver(null);
  }

  return (
    <AlertContext.Provider value={{ confirm, confirmWithInput, alert }}>
      {children}
      {/* ESC 로 닫으면 취소로 처리(결과를 안 돌려주면 확인창을 띄운 쪽이 계속 기다림) */}
      <AlertDialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : handleCancel())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
            {(config.description || config.warning) && (
              <AlertDialogDescription>
                {config.description}
                {config.warning && (
                  <span className="text-destructive mt-5 block">{config.warning}</span>
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {hasInput && (
            <div className="grid gap-2 py-2">
              <Label htmlFor="alert-context-input" className="flex items-center gap-1.5">
                {config.input?.label ?? ''}
                {config.input?.required && (
                  <span className="text-destructive" aria-hidden>
                    (*)
                  </span>
                )}
              </Label>
              <textarea
                id="alert-context-input"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (inputError) setInputError('');
                }}
                placeholder={config.input?.placeholder ?? ''}
                maxLength={maxLen}
                rows={3}
                className={cn(
                  'border-input placeholder:text-muted-foreground w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none',
                  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  inputError && 'border-destructive',
                )}
              />
              {inputError && <p className="text-destructive text-sm">{inputError}</p>}
              {maxLen > 0 && (
                <p className="text-muted-foreground text-xs">
                  {inputValue.length} / {maxLen}자
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            {config.cancelText && (
              <AlertDialogCancel onClick={handleCancel}>{config.cancelText}</AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={(e) => handleConfirm(e)}
              className={
                config.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {config.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
}
