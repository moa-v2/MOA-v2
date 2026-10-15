'use client';

import { useAlert } from '@/components/molecules/AlertContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

// Navigation API 중 쓰는 부분(2026년 1월부터 주요 브라우저 지원, TypeScript 기본 타입에는 아직 없음)
interface NavigateEventLike extends Event {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  destination: { key: string };
}
interface NavigationLike extends EventTarget {
  traverseTo(key: string): { committed: Promise<unknown>; finished: Promise<unknown> };
}

/**
 * 저장하지 않은 입력이 있을 때(enabled) 페이지를 떠나기 전에 확인(warning 은 빨간 주의 문구)
 * - 새로고침·탭 닫기·주소 직접 입력: beforeunload (문구는 브라우저 기본)
 * - 앱 안 링크(사이드바 등): Next 의 Link 보다 먼저 클릭을 가로채 확인 후 이동
 * - 브라우저 뒤로·앞으로: Navigation API 로 취소 후 확인 (지원하는 브라우저만)
 * - 버튼으로 하는 이동(router.back 등)은 confirmLeave 로 감쌈
 */
export function useLeaveGuard(enabled: boolean, message: string, warning?: string) {
  const { confirm } = useAlert();
  const router = useRouter();
  const enabledRef = useRef(enabled);
  const messageRef = useRef(message);
  const warningRef = useRef(warning);
  // 확인을 마치고 떠나는 중이면 다시 묻지 않음
  const leavingRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    messageRef.current = message;
    warningRef.current = warning;
  }, [enabled, message, warning]);

  const ask = useCallback(
    () =>
      confirm({
        title: '페이지 나가기',
        description: messageRef.current,
        warning: warningRef.current,
        confirmText: '나가기',
        cancelText: '머무르기',
      }),
    [confirm],
  );

  const leave = useCallback((go: () => void) => {
    leavingRef.current = true;
    go();
    // 이동하지 못하고 이 화면에 남는 경우를 대비해 잠시 뒤 다시 지킴
    setTimeout(() => (leavingRef.current = false), 1000);
  }, []);

  const confirmLeave = useCallback(
    async (go: () => void) => {
      if (!enabledRef.current || leavingRef.current) return go();
      if (await ask()) leave(go);
    },
    [ask, leave],
  );

  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (leavingRef.current || event.defaultPrevented || event.button !== 0) return;
      // 새 탭·새 창으로 여는 경우는 이 화면이 그대로 남음
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href);
      // 다른 사이트로 가는 링크는 beforeunload 가 처리
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      // 캡처 단계에서 막아야 Next 가 화면을 바꾸기 전에 물어볼 수 있음
      event.preventDefault();
      event.stopPropagation();
      void ask().then((ok) => {
        if (ok) leave(() => router.push(`${url.pathname}${url.search}${url.hash}`));
      });
    };

    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    const onNavigate = (event: Event) => {
      const { navigationType, destination } = event as NavigateEventLike;
      if (leavingRef.current || navigationType !== 'traverse' || !event.cancelable) return;
      // 링크 이동은 Next 가 화면을 먼저 바꾼 뒤 주소를 바꾸므로 여기서 막지 않음(위 onClick 에서 처리)
      event.preventDefault();
      void ask().then((ok) => {
        if (!ok || !navigation) return;
        leave(() => {
          const result = navigation.traverseTo(destination.key);
          result.committed.catch(() => {});
          result.finished.catch(() => {});
        });
      });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('click', onClick, true);
    navigation?.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('click', onClick, true);
      navigation?.removeEventListener('navigate', onNavigate);
    };
  }, [enabled, ask, leave, router]);

  return { confirmLeave };
}
