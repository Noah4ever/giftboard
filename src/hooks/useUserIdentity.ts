import { useEffect, useState } from "react";

const STORAGE_KEY = "giftboard.userName";

type IdentityHook = {
  name: string;
  setName: (value: string) => void;
  setNameAndReload: (value: string) => void;
  hasName: boolean;
};

export function useUserIdentity(): IdentityHook {
  const [name, setNameState] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) || "";
  });

  useEffect(() => {
    if (name) {
      localStorage.setItem(STORAGE_KEY, name);
    }
  }, [name]);

  const setName = (value: string) => {
    setNameState(value.trim());
  };

  const setNameAndReload = (value: string) => {
    setName(value);
    window.location.reload();
  };

  return { name, setName, setNameAndReload, hasName: Boolean(name) };
}
