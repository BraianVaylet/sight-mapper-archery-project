import { createFileRoute } from '@tanstack/react-router';
import { BowsScreen } from '../features/equipment/bows-screen.js';

export const Route = createFileRoute('/_app/bows/')({ component: BowsScreen });
