import { createFileRoute } from '@tanstack/react-router';
import { SightsScreen } from '../features/equipment/sights-screen.js';

export const Route = createFileRoute('/_app/sights/')({ component: SightsScreen });
