/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                cairo: ["Cairo", "sans-serif"],
            },
            colors: {
                primary: {
                    50: "#fff7ed",
                    100: "#ffedd5",
                    200: "#fed7aa",
                    300: "#fdba74",
                    400: "#fb923c",
                    500: "#ea580c",
                    600: "#dc2626",
                    700: "#b91c1c",
                    800: "#9a3412",
                    900: "#7c2d12",
                },
                secondary: {
                    50: "#ecfdf5",
                    100: "#d1fae5",
                    500: "#059669",
                    600: "#047857",
                    700: "#065f46",
                },
                accent: {
                    50: "#fff7ed",
                    100: "#ffedd5",
                    500: "#ea580c",
                    600: "#dc2626",
                    700: "#b91c1c",
                },
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-slow': 'bounce 2s infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'glow': 'glow 2s ease-in-out infinite',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                glow: {
                    '0%, 100%': { boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)' },
                    '50%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.6)' },
                },
            },
        },
    },
    plugins: [],
};
