import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";
import { useAuth } from "../hooks/useAuth";

interface RequireAuthProps {
  children?: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen message="Preparando sesion..." />;

  if (!currentUser) return <Navigate to="/login" replace />;

  return <>{children ?? <Outlet />}</>;
};
