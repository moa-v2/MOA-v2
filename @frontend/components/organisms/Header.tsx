'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useConfirmLogout } from '@/lib/auth/AuthContext';
import { Button } from '@/components/atoms/button';
import {
  HEADER_ROUTES,
  HEADER_ROUTES_LABELS,
  USER_ROUTES,
  USER_ROUTES_LABELS,
} from '@/constants/route/userRoutes';
import { ADMIN_ROUTES } from '@/constants/route/adminRoutes';
import { loginPath } from '@/lib/auth/session';

// 네비게이션 메뉴 설정
const NAV_ITEMS = [
  {
    label: USER_ROUTES_LABELS[USER_ROUTES.SHOW],
    href: USER_ROUTES.SHOW,
  },
  {
    label: USER_ROUTES_LABELS[USER_ROUTES.COMMUNITY],
    href: USER_ROUTES.COMMUNITY,
  },
];

// 로그인 안했을 때 헤더 유틸 메뉴
const UNAUTHENTICATED_ITEMS = [
  {
    label: HEADER_ROUTES_LABELS.unauthenticated[HEADER_ROUTES.LOGIN],
    href: HEADER_ROUTES.LOGIN,
    isLogout: false,
  },
];

// 로그인 했을 때 헤더 유틸 메뉴
const AUTHENTICATED_DROPDOWN_ITEMS = [
  {
    label: HEADER_ROUTES_LABELS.authenticated[HEADER_ROUTES.MY_PAGE],
    href: HEADER_ROUTES.MY_PAGE,
    isLogout: false,
  },
  {
    label: HEADER_ROUTES_LABELS.authenticated[HEADER_ROUTES.LOGOUT],
    href: HEADER_ROUTES.LOGOUT,
    isLogout: true,
  },
];

interface HeaderProps {
  hidden?: boolean;
}

export function Header({ hidden = false }: HeaderProps) {
  const { isLoggedIn, isLoading, user } = useAuth();
  const handleLogout = useConfirmLogout();
  const pathname = usePathname();

  if (hidden) {
    return null;
  }

  const showAsLoggedIn = !isLoading && isLoggedIn;

  return (
    <header className="bg-background sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-6">
        <div className="flex h-15 items-center justify-between">
          <div className="flex items-center gap-16">
            {/* Logo */}
            <div className="shrink-0">
              <Link href={USER_ROUTES.HOME} className="text-lg font-bold tracking-tight">
                MOA
              </Link>
            </div>

            {/*  Navigation */}
            <nav className="hidden gap-8 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-foreground hover:text-primary text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* UTILS */}
          <div className="flex items-center gap-4">
            {/* 로그인 여부에 따른 헤더 유틸 메뉴 */}
            <div className="flex items-center gap-2 text-sm">
              {/* 관리자 메뉴 */}
              {showAsLoggedIn && user?.role.toUpperCase() === 'ADMIN' && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mr-2 h-auto px-2 py-1 text-xs"
                >
                  <Link href={ADMIN_ROUTES.DASHBOARD}>관리자 메뉴</Link>
                </Button>
              )}

              {/* 사용자 이름 */}
              {showAsLoggedIn && (
                <span className="bg-muted/60 text-foreground rounded-md px-2.5 py-1 text-xs font-semibold">
                  {user?.name}님
                </span>
              )}

              {/* 마이페이지 | 로그아웃 */}
              {(showAsLoggedIn ? AUTHENTICATED_DROPDOWN_ITEMS : UNAUTHENTICATED_ITEMS).map(
                (item, index) => (
                  <div key={item.href} className="flex items-center gap-1">
                    {item.isLogout ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs font-normal"
                        onClick={handleLogout}
                      >
                        {item.label}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-auto px-2 py-1 text-xs font-normal"
                      >
                        {/* 로그인하면 지금 보던 화면으로 돌아옴 */}
                        <Link
                          href={item.href === HEADER_ROUTES.LOGIN ? loginPath(pathname) : item.href}
                        >
                          {item.label}
                        </Link>
                      </Button>
                    )}
                    {index <
                      (showAsLoggedIn ? AUTHENTICATED_DROPDOWN_ITEMS : UNAUTHENTICATED_ITEMS)
                        .length -
                        1 && <span className="text-slate-300">|</span>}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
