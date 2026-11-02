import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import WorkspaceShell from '../workspace/WorkspaceShell';
import { customerWorkspace } from '../workspace/navigation';

export default function CustomerLayout() {
  const { user } = useAuth();
  const workspace = useMemo(() => customerWorkspace(user), [user]);
  return <WorkspaceShell workspace={workspace} identity={{ name: user?.name, subtitle: user?.email }} />;
}
