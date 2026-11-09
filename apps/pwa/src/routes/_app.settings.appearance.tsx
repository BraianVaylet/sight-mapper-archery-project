import { createFileRoute } from '@tanstack/react-router';
import { AppearanceScreen } from '../features/account/appearance-screen.js';

export const Route = createFileRoute('/_app/settings/appearance')({ component: AppearanceScreen });
