import { createFileRoute } from '@tanstack/react-router';
import { ProfileScreen } from '../features/account/profile-screen.js';

export const Route = createFileRoute('/_app/profile')({ component: ProfileScreen });
