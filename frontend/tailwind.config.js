/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // hover styles only where a pointer can hover, so taps on phones don't leave things "stuck" hovered
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // a phone held sideways: wide but too short to stack things (iPhones are 320–430px tall this way)
      screens: { land: { raw: '(orientation: landscape) and (max-height: 500px)' } },
      colors: {
        bg: '#0B0D10',
        surface: '#14181E',
        surface2: '#1B2129',
        surface3: '#232A34',
        line: '#262E39',
        accent: { DEFAULT: '#E10600', hi: '#FF2A1F', lo: '#9E0400' },
        ink: '#F5F5F5',
        muted: '#9299A3',
        faint: '#5E6672',
        ok: '#3DBE7A',
        warn: '#F2A93B',
      },
      fontFamily: {
        // Headlines: PP Formula Condensed Black once licensed, Barlow Condensed until then.
        display: ['"PP Formula Condensed"', '"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['"Titillium Web"', 'system-ui', 'sans-serif'],
      },
      // one radius family, kept tight to match the login screen: controls 6px, cards 10px, sheets 12px
      borderRadius: { xl: '10px', '2xl': '12px' },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.8)',
        lift: '0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 40px -16px rgba(0,0,0,0.9)',
        red: '0 10px 30px -12px rgba(225,6,0,0.55)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'none' } },
        shimmer: { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
        lamp: { from: { transform: 'scale(0.6)', opacity: '0.4' }, to: { transform: 'none', opacity: '1' } },
        drum: { '25%': { transform: 'translate(-1.5px,1px)' }, '50%': { transform: 'translate(1.5px,-1px)' }, '75%': { transform: 'translate(-1px,-1.5px)' } },
        grow: { from: { transform: 'scaleY(0.05)' }, to: { transform: 'none' } },
        rainlight: { '0%, 55%': { opacity: '1' }, '60%, 100%': { opacity: '0.2' } },
        // a headline line rising out of its mask (see RevealHeadline on the login page)
        linein: { from: { opacity: '0', transform: 'translateY(100%)' }, to: { opacity: '1', transform: 'none' } },
        // a podium place's name and points coming up behind its step
        podin: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        // the Prediction Pass stub settling into place under the perforation
        stub: { from: { opacity: '0', transform: 'translateY(-10px) rotate(-1.5deg)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.22,1,.36,1) both',
        pop: 'pop .28s cubic-bezier(.22,1,.36,1)',
        shimmer: 'shimmer 1.4s linear infinite',
        lamp: 'lamp .25s cubic-bezier(.22,1,.36,1) both',
        drum: 'drum .12s linear infinite',
        grow: 'grow .7s cubic-bezier(.22,1,.36,1) both',
        rainlight: 'rainlight 1.2s linear infinite',
        linein: 'linein .38s cubic-bezier(.2,.7,.2,1) both',
        stub: 'stub .45s cubic-bezier(.22,1,.36,1) .2s both',
        podin: 'podin .3s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
};
