import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../features/account/settings-screen.js';

export const Route = createFileRoute('/_app/settings/')({
  component: function SettingsRoute() {
    return <SettingsScreen />;
  },
});
