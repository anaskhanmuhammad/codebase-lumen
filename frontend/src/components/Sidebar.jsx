"use client";

import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  ChevronRight,
  ChevronDown,
  Home,
  Settings,
  SearchCode,
  DockIcon,
  FolderOpen,
  KeyRound,
} from "lucide-react";
import Link from "next/link";

export default function AppSidebar() {
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  return (
    <Sidebar className="border-r bg-background/50 backdrop-blur-sm">
      <SidebarContent>
        {/* === MAIN SECTION === */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard (Collapsible) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setIsDashboardOpen(!isDashboardOpen)}
                  className="flex items-center justify-between w-full cursor-pointer"
                >
                  <div className="flex items-center">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </div>
                  {isDashboardOpen ? (
                    <ChevronDown className="h-4 w-4 transition-transform" />
                  ) : (
                    <ChevronRight className="h-4 w-4 transition-transform" />
                  )}
                </SidebarMenuButton>

                {isDashboardOpen && (
                  <SidebarMenuSub className="ml-6 mt-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <Link href="/dashboard/project1">Project 1</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <Link href="/dashboard/project2">Project 2</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>

              {/* Projects */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/projects">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Projects
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Scan Dockerfile */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/scan-dockerfile">
                    <DockIcon className="mr-2 h-4 w-4" />
                    Scan Dockerfile
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* API Keys */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/api-keys">
                    <KeyRound className="mr-2 h-4 w-4" />
                    API Keys
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/compare">
                    <Settings className="mr-2 h-4 w-4" />
                    Compare
                  </Link>
                </SidebarMenuButton>

                {/* Code Search */}

                <SidebarMenuButton asChild>
                  <Link href="/code-search">
                    <SearchCode className="mr-2 h-4 w-4" />
                    Code-search
                  </Link>
                </SidebarMenuButton>

                {/* leaderboard */}
                <SidebarMenuButton asChild>
                  <Link href="/llm-leaderboard">
                    <SearchCode className="mr-2 h-4 w-4" />
                    llm leaderboard
                  </Link>
                </SidebarMenuButton>

                {/* <SidebarMenuButton asChild>
                  <Link href="/compare">
                    <SearchCode className="mr-2 h-4 w-4" />
                    Repository Scanner
                  </Link>
                </SidebarMenuButton> */}


              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
