/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: [
    // Pour la grille de navigation des 17 questions
    'grid-cols-9',
    'grid-cols-17',
    // Badges dynamiques de statut du quiz
    'bg-beige-200', 'text-ink-900',
    'bg-green-100', 'text-green-800',
    'bg-bordeaux-600/10', 'text-bordeaux-700',
    'bg-rose-200',
    // Page podium (couleurs des médailles)
    'from-amber-400', 'to-yellow-200', 'text-amber-900', 'ring-amber-300',
    'from-zinc-400', 'to-zinc-200', 'text-zinc-800',
    'from-orange-700', 'to-orange-400', 'text-orange-100',
    'bg-beige-500',
  ],
  theme: {
    extend: {
      colors: {
        // Palette inspirée du flyer APELAV "Journée Shopping"
        rose: {
          50:  '#FBF3F2',
          100: '#F7E7E6',
          200: '#F0D2CF',
          300: '#E8C5C5',   // rose poudré dominant
          400: '#DDA6A4',
          500: '#C98785',
          600: '#A35F5D',
        },
        beige: {
          50:  '#FBF6EF',
          100: '#F6EDE0',
          200: '#EFE0C8',
          300: '#E8D4B0',   // beige du badge "Entrée 1€"
          400: '#D9BC8B',
          500: '#B89968',
        },
        ink: {
          800: '#3A2A2A',
          900: '#241818',   // texte noir chaud
        },
        bordeaux: {
          600: '#8B3A3A',
          700: '#6E2A2A',
        },
      },
      fontFamily: {
        // Display script style (Journée Shopping)
        display: ['"Great Vibes"', 'cursive'],
        // Serif élégant pour titres
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        // Sans pour le corps
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -10px rgba(163, 95, 93, 0.15)',
        card: '0 4px 20px -4px rgba(163, 95, 93, 0.1)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      gridTemplateColumns: {
        '17': 'repeat(17, minmax(0, 1fr))',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
