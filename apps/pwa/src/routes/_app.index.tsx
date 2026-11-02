import { createFileRoute } from '@tanstack/react-router';
import { HomeScreen } from '../features/setups/home-screen.js';

export const Route = createFileRoute('/_app/')({ component: HomeScreen });
