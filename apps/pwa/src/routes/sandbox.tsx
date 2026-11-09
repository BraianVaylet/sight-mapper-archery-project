import { createFileRoute, notFound } from '@tanstack/react-router';
import { SandboxScreen } from '../features/sandbox/sandbox-screen.js';

/** The test bench exists only in development: in a build it is a plain 404. */
export const Route = createFileRoute('/sandbox')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: SandboxScreen,
});
