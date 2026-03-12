/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        surface: {
          primary: '#0A0A0B',
          secondary: '#111113',
          tertiary: '#1A1A1D',
          elevated: '#222225',
        },
        border: {
          default: '#2A2A2E',
          subtle: '#1E1E22',
        },
        content: {
          primary: '#EDEDEF',
          secondary: '#A0A0A8',
          tertiary: '#6B6B74',
        },
        accent: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          muted: '#1E3A5F',
        },
        success: {
          DEFAULT: '#22C55E',
          muted: '#14532D',
        },
        warning: {
          DEFAULT: '#EAB308',
          muted: '#422006',
        },
        danger: {
          DEFAULT: '#EF4444',
          muted: '#450A0A',
        },
      },
    },
  },
  plugins: [],
};
