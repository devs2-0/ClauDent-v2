import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequirePermission, useAuth } from "@/auth";
import { ProtectedLayout } from "../layouts/ProtectedLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { notFoundRoute, protectedRoutes, publicRoutes } from "./routeConfig";

const RootRedirect = () => {
  const { currentUser } = useAuth();
  return <Navigate to={currentUser ? "/dashboard" : "/login"} replace />;
};

const PublicOnlyRoute = ({ element }: { element: React.ReactElement }) => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" replace /> : element;
};

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={<PublicOnlyRoute element={route.element} />} />
          ))}
        </Route>

        <Route path="/" element={<RootRedirect />} />

        <Route element={<RequireAuth><ProtectedLayout /></RequireAuth>}>
          {protectedRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<RequirePermission permission={route.permission}>{route.element}</RequirePermission>}
            />
          ))}
        </Route>

        <Route path={notFoundRoute.path} element={notFoundRoute.element} />
      </Routes>
    </BrowserRouter>
  );
};
