import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import WorkspaceShell from '../workspace/WorkspaceShell';
import { vendorWorkspace } from '../workspace/navigation';

export default function VendorLayout() {
  const { user } = useAuth();
  const workspace = useMemo(() => vendorWorkspace(), []);
  return <WorkspaceShell workspace={workspace} identity={{ name: user?.vendorProfile?.businessName || user?.name, subtitle: user?.email }} />;
}
