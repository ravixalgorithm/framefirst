"use client";

import Link from "next/link";

import { useState, useEffect } from "react";
import {
  BarChart3,
  CalendarDays,
  Radar,
  Link2,
  Settings,
  TestTube2,
  Users,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Sprout,
  Blocks,
  PanelLeft,
  type LucideIcon
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Project } from "@framefirst/types/api";

import { LogoutButton } from "./logout-button";
import { Button } from "./ui/button";

type NavItem = {
  label: string;
  icon?: LucideIcon;
  path?: string;
  absolute?: boolean;
  children?: NavItem[];
  badge?: React.ReactNode;
  color?: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: Radar,
    color: "text-indigo-500",
    path: ""
  },
  {
    label: "Growth",
    icon: Sprout,
    color: "text-emerald-500",
    children: [
      { label: "UTM Links", path: "/utm", badge: <span className="bg-orange-200 text-orange-900 text-[10px] font-bold px-1.5 py-0.5 rounded">3</span> },
      { label: "A/B Tests", path: "/ab-tests" }
    ]
  },
  {
    label: "Workspace",
    icon: Blocks,
    color: "text-amber-500",
    children: [
      { label: "Settings", path: "/settings" },
      { label: "Projects", path: "/projects", absolute: true }
    ]
  }
];

export function DashboardShell({
  siteId,
  project,
  projects,
  userEmail,
  children
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "Growth": true,
    "Workspace": true
  });

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden relative bg-slate-50">
      {/* Liquid Glass Background Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/30 blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-300/20 blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-amber-200/30 blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
      </div>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`group/sidebar fixed inset-y-0 left-0 z-50 bg-white lg:bg-transparent flex flex-col transform transition-all duration-300 ease-in-out lg:static ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 ${isSidebarCollapsed ? "lg:w-[74px] lg:overflow-hidden lg:cursor-pointer collapsed" : "w-64 lg:w-64"}`}
        onClick={() => {
          if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        }}
      >
        <div className="w-64 flex flex-col h-full">
          <div className="p-4 pb-2 flex items-center justify-between">
          <Link className={`group/navitem dock-wrapper flex items-center gap-2.5 text-xl font-bold tracking-tight mb-4 px-1 lg:mb-4 lg:mt-0 mt-2 hover:opacity-80 transition-all ${isSidebarCollapsed ? 'ml-[3px]' : ''}`} href="/projects">
            <div className="h-7 w-7 rounded bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-black shadow-sm flex-shrink-0 dock-icon">
              FF
            </div>
            <span className={`transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>Frame First</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </Button>
        </div>

        <div className={`px-4 transition-[grid-template-rows,opacity,padding] duration-300 ease-in-out grid ${isSidebarCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none pb-0' : 'grid-rows-[1fr] opacity-100 pb-2'}`}>
          <div className="overflow-hidden">
            <div className="space-y-1">
              <label htmlFor="project-switcher" className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-2 mb-1 block">Project</label>
              <div className="relative">
                <select
                  id="project-switcher"
                  value={siteId}
                  onChange={(event) => router.push(`/dashboard/${event.target.value}`)}
                  className="w-full bg-white/60 hover:bg-white rounded-lg px-3 py-2 text-sm font-medium focus:outline-none shadow-sm appearance-none cursor-pointer transition-colors"
                >
                  {projects.map((item) => (
                    <option key={item.id} value={item.snippetKey}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1" aria-label="Dashboard">
          {navItems.map((item) => {
            const Icon = item.icon!;
            
            if (item.children) {
              const isExpanded = expandedItems[item.label];
              return (
                <div key={item.label} className="flex flex-col">
                  <button 
                    onClick={(e) => {
                      if (isSidebarCollapsed) return;
                      toggleExpand(item.label);
                    }}
                    className="group/navitem dock-wrapper flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-slate-200/50 transition-colors focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} aria-hidden="true" className={`flex-shrink-0 dock-icon ${item.color} ${isExpanded ? "opacity-100" : "opacity-60 group-hover/navitem:opacity-100"}`} />
                      <span className={`font-semibold transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>{item.label}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className={`text-muted-foreground transition-opacity duration-200 flex-shrink-0 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`} /> : <ChevronDown size={16} className={`text-muted-foreground transition-opacity duration-200 flex-shrink-0 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`} />}
                  </button>
                  
                  <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out ${!isExpanded || isSidebarCollapsed ? 'grid-rows-[0fr] opacity-0 pointer-events-none mt-0 mb-0' : 'grid-rows-[1fr] opacity-100 mt-1 mb-2'}`}>
                      <div className="overflow-hidden">
                        <div className="relative">
                          {/* Vertical trunk line */}
                          <div className="absolute left-[20px] top-0 bottom-[20px] border-l-[1.5px] border-border/60" />
                          
                          <div className="flex flex-col space-y-1">
                            {item.children.map((child) => {
                              const href = child.absolute ? child.path! : `/dashboard/${siteId}${child.path}`;
                              const active = child.absolute
                                ? pathname === child.path
                                : child.path === ""
                                  ? pathname === href
                                  : pathname.startsWith(href);
                                  
                              return (
                                <div key={child.label} className="relative">
                                  {/* Curved branch */}
                                  <div className="absolute left-[20px] top-0 h-1/2 w-4 border-l-[1.5px] border-b-[1.5px] border-border/60 rounded-bl-[10px]" />
                                  
                                  <Link
                                    href={href}
                                    className={`flex items-center gap-3 rounded-lg ml-10 px-3 py-2 text-sm transition-all focus:outline-none ${
                                      active
                                        ? "bg-white text-foreground font-semibold shadow-sm"
                                        : "text-muted-foreground font-medium hover:text-foreground hover:bg-slate-200/30"
                                    }`}
                                  >
                                    {child.label}
                                    {child.badge && <span className="ml-auto">{child.badge}</span>}
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              );
            }

            // Top level link
            const href = item.absolute ? item.path! : `/dashboard/${siteId}${item.path}`;
            const active = item.absolute
              ? pathname === item.path
              : item.path === ""
                ? pathname === href
                : pathname.startsWith(href);

            return (
              <Link
                key={item.label}
                href={href}
                className={`group/navitem dock-wrapper flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all focus:outline-none ${
                  active
                    ? "bg-white text-foreground font-semibold shadow-sm"
                    : "text-muted-foreground font-medium hover:bg-slate-200/50 hover:text-foreground"
                }`}
              >
                <Icon size={18} aria-hidden="true" className={`flex-shrink-0 dock-icon ${item.color} ${active ? "opacity-100" : "opacity-60 group-hover/navitem:opacity-100"}`} />
                <span className={`font-semibold transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>{item.label}</span>
                {item.badge && <span className={`ml-auto transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 flex flex-col gap-1 mt-auto">
          <div className={`group/navitem dock-wrapper flex items-center gap-3 px-3 py-2 mb-1 transition-all ${isSidebarCollapsed ? '-ml-[7px]' : ''}`}>
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0 dock-icon">
              {userEmail.slice(0, 1).toUpperCase()}
            </div>
            <div className={`flex flex-col text-sm min-w-0 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              <span className="font-semibold truncate text-foreground">{userEmail}</span>
              <span className="text-xs text-muted-foreground truncate">{project.name}</span>
            </div>
          </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className={`flex-1 relative z-10 flex flex-col min-w-0 bg-background lg:rounded-l-[2rem] lg:rounded-r-xl lg:border lg:border-border/50 lg:shadow-[-15px_0_30px_-15px_rgba(0,0,0,0.1)] lg:overflow-hidden transition-all duration-300 lg:my-1.5 lg:mr-1.5 ${isSidebarCollapsed ? "lg:ml-1.5" : ""}`}>
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-background lg:bg-transparent border-b border-border lg:border-none">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={20} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden lg:flex text-muted-foreground hover:text-foreground" 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              <PanelLeft size={20} />
            </Button>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
              <span className="text-muted-foreground/50">/</span>
              <span className="truncate max-w-[150px] sm:max-w-xs text-foreground">{project.name}</span>
            </div>
          </div>
          <div>
            {/* Timeline selector removed per design */}
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
