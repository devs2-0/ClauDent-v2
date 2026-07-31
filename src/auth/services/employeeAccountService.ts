import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";
import type { AppUserStatus } from "../types/user.types";

export interface CreateEmployeeUserPayload {
  email: string;
  displayName: string;
  password: string;
  phone?: string;
  roleIds: string[];
  status: AppUserStatus;
}

const createEmployeeUserFn = httpsCallable<
  CreateEmployeeUserPayload,
  { uid: string; email: string; displayName: string; status: AppUserStatus }
>(functions, "createEmployeeUser");

const assignEmployeeRolesFn = httpsCallable<
  { uid: string; roleIds: string[] },
  { uid: string; roleIds: string[]; permissions: string[]; isAdmin: boolean }
>(functions, "assignEmployeeRoles");

const updateEmployeeStatusFn = httpsCallable<
  { uid: string; status: AppUserStatus },
  { uid: string; status: AppUserStatus }
>(functions, "updateEmployeeStatus");

const deleteEmployeeUserFn = httpsCallable<
  { uid: string },
  { uid: string; deleted: boolean }
>(functions, "deleteEmployeeUser");

export const employeeAccountService = {
  createEmployeeUser: async (payload: CreateEmployeeUserPayload) => {
    const result = await createEmployeeUserFn(payload);
    return result.data;
  },

  assignEmployeeRoles: async (uid: string, roleIds: string[]) => {
    const result = await assignEmployeeRolesFn({ uid, roleIds });
    return result.data;
  },

  updateEmployeeStatus: async (uid: string, status: AppUserStatus) => {
    const result = await updateEmployeeStatusFn({ uid, status });
    return result.data;
  },

  deleteEmployeeUser: async (uid: string) => {
    const result = await deleteEmployeeUserFn({ uid });
    return result.data;
  },
};