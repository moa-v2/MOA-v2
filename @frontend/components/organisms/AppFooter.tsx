'use client';

import { USER_ROUTES, USER_ROUTES_LABELS } from '@/constants/route/userRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HIDE_SITE_CHROME_PREFIXES } from './AppHeader';

const GITHUB_URL = 'https://github.com/moa-v2/MOA-v2';

export function AppFooter() {
  const pathname = usePathname();
  if (HIDE_SITE_CHROME_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <footer className="border-t bg-slate-50">
      <div className="container mx-auto flex flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-8">
          <Link
            href={USER_ROUTES.HOME}
            className="text-2xl font-bold tracking-tight text-slate-400"
          >
            MOA
          </Link>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">MOA Place</p>
            <p className="text-muted-foreground">Copyright © MOA Corp. All Rights Reserved.</p>
          </div>
        </div>
        <nav className="flex gap-6 text-sm">
          <Link href={USER_ROUTES.SHOW} className="hover:text-primary">
            {USER_ROUTES_LABELS[USER_ROUTES.SHOW]}
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
