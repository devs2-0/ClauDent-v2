import React from "react";
import { Link, useLocation } from "react-router-dom";

import { navigationItems } from "@/app/navigation/navigationItems";
import { useCan } from "@/auth";
import { cn } from "@/shared/utils/utils";

export function BottomNav() {
  const location = useLocation();
  const { can } = useCan();
  const visibleItems = navigationItems
    .filter((item) => item.mobile)
    .filter((item) => (item.anyPermission ? item.anyPermission.some((permission) => can(permission)) : can(item.permission)))
    .slice(0, 5);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-5 border-t bg-background/95 backdrop-blur md:hidden"
    >
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.url;
        const Icon = item.icon;
        return (
          <Link
            key={item.url}
            to={item.url}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
