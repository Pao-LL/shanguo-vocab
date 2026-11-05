/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F7F8',
        ink: '#111318',
        mute: '#5B6570',
        line: '#D5DEE3',
        sheet: '#FFFFFF',
        accent: '#2DD4BF',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui'],
        serif: ['"Libre Bodoni"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
