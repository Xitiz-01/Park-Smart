import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import WorkspaceShell from '../workspace/WorkspaceShell';
import { adminWorkspace } from '../workspace/navigation';

export default function AdminLayout() {
  const { user, isSuperAdmin } = useAuth();
  const workspace = useMemo(() => adminWorkspace({ isSuperAdmin }), [isSuperAdmin]);
  return <WorkspaceShell workspace={workspace} identity={{ name: user?.name, subtitle: user?.email }} />;
}
