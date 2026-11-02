import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/ThemeProvider';

// One click flips light ↔ dark. Until it's clicked, the theme follows the
// device setting; after that the choice is remembered.
export default function ThemeToggle({ className }) {
  const { theme, setPreference } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setPreference(next)}
      className={className}
    >
      <Icon />
    </Button>
  );
}
