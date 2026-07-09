import React from "react";
import { Badge } from "@/shared/components/ui/badge";

interface RoleBadgeProps {
  label: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ label }) => {
  return <Badge variant="secondary">{label}</Badge>;
};
