'use client';

import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getAuthUser, logout as logoutApi } from '@/lib/api/auth/auth';
import { setGlobalOnUnauthorized, setGlobalRouter } from '@/lib/api-client';
import { loginPathFromHere } from '@/lib/auth/session';
import { useAlert } from '@/components/molecules/AlertContext';
import { UserRole } from '@shared/enums';

export interface User {
  name: string;
  email: string;
  picture?: string;
  phone?: string;
  provider: string;
  providerId: string;
  role: UserRole;
}

interface AuthContextType {
  user?: User;
  isLoggedIn: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery(getAuthUser());

  const { mutateAsync: logoutMutation } = useMutation(logoutApi());

  const clearSessionAndRedirect = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['auth', 'user'] });
    router.replace('/');
  }, [queryClient, router]);

  // 로그인이 풀린 채 API 를 부르면(재발급도 실패) 지금 화면으로 돌아오는 로그인 화면으로
  const redirectToLogin = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['auth', 'user'] });
    router.replace(loginPathFromHere());
  }, [queryClient, router]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } finally {
      clearSessionAndRedirect();
    }
  }, [logoutMutation, clearSessionAndRedirect]);

  useEffect(() => {
    setGlobalRouter(router);
    setGlobalOnUnauthorized(redirectToLogin);
    return () => {
      setGlobalOnUnauthorized(null);
    };
  }, [router, redirectToLogin]);

  const value: AuthContextType = {
    user,
    isLoggedIn: !!user,
    isLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** 로그아웃 핸들러 훅 */
export function useConfirmLogout() {
  const { logout } = useAuth();
  const { confirm } = useAlert();

  return useCallback(async () => {
    const result = await confirm({
      title: '로그아웃',
      description: '로그아웃 하시겠습니까?',
    });
    if (result) await logout();
  }, [logout, confirm]);
}
