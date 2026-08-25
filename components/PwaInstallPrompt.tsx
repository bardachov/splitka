"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS у режимі «як на Mac» видає себе за Macintosh, але має тач
  const iPadAsMac = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadAsMac;
}

function ShareIcon() {
  return (
    <svg
      className="share-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path d="M12 2.5l4 4h-3V14h-2V6.5H8l4-4z" fill="currentColor" />
      <path d="M5 10h4v2H7v8h10v-8h-2v-2h4v12H5V10z" fill="currentColor" />
    </svg>
  );
}

export default function PwaInstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "install" | "ios">("hidden");
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIos()) {
      setMode("ios");
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setMode("install");
    };
    const onInstalled = () => setMode("hidden");

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => setMode("hidden");

  const install = () => {
    const ev = installEvent;
    if (!ev) return;
    setInstallEvent(null);
    close();
    void ev.prompt();
  };

  return (
    <Modal open={mode !== "hidden"} onClose={close} title="Встановіть Splitka">
      {mode === "ios" ? (
        <>
          <p className="confirm-message">
            Додайте Splitka на Початковий екран — апка відкриватиметься
            миттєво і працюватиме на весь екран.
          </p>
          <ol className="install-steps">
            <li>
              <span>
                Натисніть «Поділитися» <ShareIcon /> в панелі Safari
              </span>
            </li>
            <li>
              <span>
                Оберіть <b>«На Початковий екран»</b>
              </span>
            </li>
          </ol>
          <button className="btn" onClick={close}>
            Зрозуміло
          </button>
        </>
      ) : (
        <>
          <p className="confirm-message">
            Додайте Splitka на головний екран — апка запускатиметься миттєво
            і працюватиме як звичайний застосунок.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={close}>
              Не зараз
            </button>
            <button className="btn" onClick={install}>
              Встановити
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
