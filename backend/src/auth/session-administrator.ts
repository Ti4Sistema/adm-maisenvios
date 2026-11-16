import { Request } from 'express';
import { Permission } from '../access/permissions';

export interface SessionAdministrator {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: Permission[];
}

export interface AuthenticatedRequest extends Request {
  administrator: SessionAdministrator;
}
