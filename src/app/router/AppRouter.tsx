import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { ProtectedRouteByPermission, RequireAuth, useAuth } from "@/auth";

import { ProtectedLayout } from "../layouts/ProtectedLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { notFoundRoute, protectedRoutes, publicRoutes } from "./routeConfig";

const RootRedirect = () => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen />;

  return currentUser ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
};

const PublicOnlyRoute = ({ element }: { element: React.ReactElement }) => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen />;

  return currentUser ? <Navigate to="/dashboard" replace /> : element;
};

const AuthLoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Comprobando sesión...</p>
    </div>
  </div>
);

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          {publicRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<PublicOnlyRoute element={route.element} />}
            />
          ))}
        </Route>

        <Route
          element={
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          }
        >
          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <ProtectedRouteByPermission permission={route.permission} anyPermission={route.anyPermission}>
                  {route.element}
                </ProtectedRouteByPermission>
              }
            />
          ))}
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path={notFoundRoute.path} element={notFoundRoute.element} />
      </Routes>
    </BrowserRouter>
  );
};
