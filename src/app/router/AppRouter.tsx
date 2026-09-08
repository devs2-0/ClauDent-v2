import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import {
  AuthLoadingScreen,
  ProtectedRouteByPermission,
  RequireAuth,
  useAuth,
} from "@/auth";

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

const PublicRoute = ({
  element,
  redirectAuthenticated = false,
}: {
  element: React.ReactElement;
  redirectAuthenticated?: boolean;
}) => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen />;

  if (redirectAuthenticated && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
};

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          {publicRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <PublicRoute
                  element={route.element}
                  redirectAuthenticated={route.redirectAuthenticated}
                />
              }
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
                <ProtectedRouteByPermission permission={route.permission}>
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
