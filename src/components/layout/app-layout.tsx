'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useAuthStore } from '@/stores/auth-store';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { motion, AnimatePresence } from 'framer-motion';

const pageNames: Record<string, string> = {
  dashboard: 'Dashboard',
  courses: 'Browse Courses',
  'course-detail': 'Course Details',
  'course-editor': 'Course Editor',
  'my-courses': 'My Courses',
  assignments: 'Assignments',
  announcements: 'Announcements',
  'admin-users': 'User Management',
  'admin-audit': 'Audit Logs',
  profile: 'Profile',
  notifications: 'Notifications',
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentPage } = useAppStore();
  const { user, logout, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Listen for auth:logout events from API helper
  useEffect(() => {
    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout]);

  const userInitials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U';

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        {/* Header - glass card effect */}
        <header className="glass-card sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 px-4 md:px-6 transition-all duration-300">
          <SidebarTrigger className="-ml-1 h-9 w-9 rounded-xl hover:bg-muted/60 transition-colors" />
          <Separator orientation="vertical" className="mr-1 h-5 bg-border/40" />

          {/* Breadcrumb */}
          <Breadcrumb className="hidden sm:flex">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    useAppStore.getState().navigate('dashboard');
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Elévate
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-muted-foreground/40" />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{pageNames[currentPage] || currentPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search (desktop) - glass style rounded-full */}
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9 w-72 rounded-full bg-muted/40 border-0 focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all duration-200 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Notifications - with animated badge */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-xl hover:bg-muted/60 transition-colors"
            onClick={() => useAppStore.getState().navigate('notifications')}
          >
            <Bell className="h-[18px] w-[18px]" />
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center animate-pulse"
            >
              3
            </Badge>
          </Button>

          {/* User menu - larger avatar with ring on hover */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9 hover:ring-2 hover:ring-primary/20 transition-all duration-200"
              >
                <Avatar className="h-8 w-8 ring-1 ring-border/50 transition-all duration-200">
                  <AvatarImage src={user?.avatar || undefined} alt={user?.firstName} />
                  <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl p-1.5 bg-popover/95 backdrop-blur-xl border-border/40"
            >
              <DropdownMenuItem
                onClick={() => useAppStore.getState().navigate('profile')}
                className="rounded-lg px-3 py-2 cursor-pointer"
              >
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={logout}
                className="rounded-lg px-3 py-2 text-destructive cursor-pointer"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content - centered */}
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  mass: 0.8,
                }}
                className="min-h-[calc(100vh-10rem)]"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer - cleaner with glass top border */}
        <footer className="relative border-t border-border/30 bg-background/50 backdrop-blur-sm px-4 py-4 md:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground/70 sm:flex-row">
            <p className="text-muted-foreground/50">
              &copy; {new Date().getFullYear()} Elévate LMS Platform. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="hover:text-foreground cursor-pointer transition-colors duration-200">Privacy</span>
              <span className="hover:text-foreground cursor-pointer transition-colors duration-200">Terms</span>
              <span className="hover:text-foreground cursor-pointer transition-colors duration-200">Support</span>
            </div>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
