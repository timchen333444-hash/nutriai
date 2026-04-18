/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4a7c59',
        'primary-dark': '#2d5a3d',
        'primary-light': '#f0f7f4',
        'primary-muted': '#d4eadc',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      maxWidth: {
        app: '540px',
      },
      // Scale up text sizes across the board for legibility (older-user friendly)
      fontSize: {
        xs:   ['13px', { lineHeight: '1.5'  }],  // was 12px
        sm:   ['15px', { lineHeight: '1.55' }],  // was 14px
        base: ['16px', { lineHeight: '1.6'  }],  // unchanged — true body size
        lg:   ['18px', { lineHeight: '1.55' }],
        xl:   ['20px', { lineHeight: '1.5'  }],
        '2xl':['24px', { lineHeight: '1.4'  }],
        '3xl':['30px', { lineHeight: '1.35' }],
      },
      spacing: {
        // Convenient touch-target shorthands
        'touch': '48px',
      },
    },
  },
  plugins: [],
};
