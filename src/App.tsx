import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sun, Moon, User, Gift, LayoutDashboard } from "lucide-react";
import { Modal } from "./components/Modal";
import { useUserIdentity } from "./hooks/useUserIdentity";
import "./styles/index.scss";

export default function App() {
  const { t, i18n } = useTranslation();
  const { name, setNameAndReload } = useUserIdentity();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileValue, setProfileValue] = useState(name);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const profileRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const setLang = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    const saved = localStorage.getItem("i18nextLng");
    if (!saved) {
      setLang("de");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (profileOpen && profileRef.current) {
      const el = profileRef.current;
      const len = el.value.length;
      el.focus();
      el.setSelectionRange(len, len);
    }
  }, [profileOpen]);

  const confirmProfile = () => {
    if (!profileValue.trim()) return;
    setProfileOpen(false);
    setNameAndReload(profileValue);
  };

  return (
    <div className="shell">
      <nav className="topbar">
        <NavLink to="/" className="brand" end>
          <Gift size={20} />
          {t("brand")}
        </NavLink>
        <div className="top-actions">
          <button
            className="ghost"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            className="ghost"
            onClick={() => setLang(i18n.language === "de" ? "en" : "de")}
          >
            {i18n.language === "de" ? "DE" : "EN"}
          </button>
          <button
            className="ghost profile-btn"
            onClick={() => setProfileOpen(true)}
          >
            <User size={16} /> {name || t("identityTitle")}
          </button>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>

      <Modal
        open={profileOpen}
        title={t("identityTitle")}
        onClose={() => setProfileOpen(false)}
      >
        <div className="stack">
          <p className="hint">{t("identityHint")}</p>
          {name ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setProfileOpen(false);
                navigate("/me");
              }}
            >
              <LayoutDashboard size={16} /> My boards
            </button>
          ) : null}
          <input
            ref={profileRef}
            value={profileValue}
            onChange={(e) => setProfileValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmProfile();
              }
            }}
            placeholder={t("identityPlaceholder")}
          />
          <div className="actions">
            <button
              className="ghost"
              type="button"
              onClick={() => setProfileOpen(false)}
            >
              {t("cancel")}
            </button>
            <button type="button" onClick={confirmProfile}>
              OK
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
