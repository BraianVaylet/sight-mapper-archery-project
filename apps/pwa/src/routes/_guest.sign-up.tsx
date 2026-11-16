import { createFileRoute } from '@tanstack/react-router';
import { SignUpScreen } from '../features/auth/sign-up-screen.js';

export const Route = createFileRoute('/_guest/sign-up')({ component: SignUpScreen });
