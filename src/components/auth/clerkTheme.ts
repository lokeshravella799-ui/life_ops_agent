import { dark } from '@clerk/themes';

/**
 * LifeOps Cyberpunk Dark Theme configuration for Clerk components
 */
export const lifeOpsClerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#06b6d4', // Neon cyan
    colorText: '#f4f4f5', // Zinc 100
    colorTextSecondary: '#a1a1aa', // Zinc 400
    colorBackground: '#090914', // Deep space dark
    colorInputBackground: '#121222', // Input dark
    colorInputText: '#ffffff',
    borderRadius: '0.75rem', // Rounded corners matching LifeOps
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  elements: {
    card: {
      backgroundColor: '#070710',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(6, 182, 212, 0.12)',
    },
    headerTitle: {
      color: '#ffffff',
      fontWeight: '700',
      letterSpacing: '-0.02em',
    },
    headerSubtitle: {
      color: '#a1a1aa',
    },
    socialButtonsBlockButton: {
      backgroundColor: '#111120',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#181830',
        borderColor: 'rgba(6, 182, 212, 0.4)',
      },
    },
    formButtonPrimary: {
      background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #9333ea 100%)',
      color: '#ffffff',
      fontWeight: '600',
      border: 'none',
      boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
      '&:hover': {
        opacity: '0.92',
        boxShadow: '0 0 25px rgba(6, 182, 212, 0.5)',
      },
    },
    formFieldInput: {
      backgroundColor: '#101020',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      color: '#ffffff',
      '&:focus': {
        borderColor: '#06b6d4',
        boxShadow: '0 0 0 2px rgba(6, 182, 212, 0.25)',
      },
    },
    footerActionLink: {
      color: '#06b6d4',
      '&:hover': {
        color: '#38bdf8',
      },
    },
    userButtonPopoverCard: {
      backgroundColor: '#090914',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 10px 40px rgba(0,0,0,0.9), 0 0 20px rgba(6, 182, 212, 0.15)',
    },
  },
};
