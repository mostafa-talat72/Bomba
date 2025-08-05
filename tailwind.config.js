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
        },
    },
    plugins: [],
};
