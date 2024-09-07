import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

i18n
  .use(Backend) // Load translation files
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    fallbackLng: "en", // Default language
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json", // Path to load translation files
    },
  });

export default i18n;
