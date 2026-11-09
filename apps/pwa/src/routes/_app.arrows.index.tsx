import { createFileRoute } from '@tanstack/react-router';
import { ArrowsScreen } from '../features/equipment/arrows-screen.js';

export const Route = createFileRoute('/_app/arrows/')({ component: ArrowsScreen });
