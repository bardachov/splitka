"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { detectIosTarget, isIosUA, type IosTarget } from "@/lib/platform";
import { copyText } from "@/lib/clipboard";

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

function IosSteps({ target }: { target: Exclude<IosTarget, "inApp"> }) {
  const where =
    target === "safari"
      ? "на панелі знизу"
      : target === "topRight"
        ? "справа вгорі"
        : null;

  return (
    <ol className="install-steps">
      {target === "behindMenu" && (
        <li>
          <span>
            Відкрийте меню <b>«⋯»</b>
          </span>
        </li>
      )}
      <li>
        <span>
          Натисніть «Поділитися» <ShareIcon />
          {where ? ` ${where}` : ""}
        </span>
      </li>
      <li>
        <span>
          Оберіть <b>«На Початковий екран»</b>
        </span>
      </li>
    </ol>
  );
}

export default function PwaInstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "install" | "ios">("hidden");
  const [iosTarget, setIosTarget] = useState<IosTarget>("safari");
  const [copied, setCopied] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    if (isIosUA(navigator.userAgent, navigator.maxTouchPoints)) {
      setIosTarget(detectIosTarget(navigator.userAgent));
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

  async function copyLink() {
    setCopied(await copyText(window.location.href));
  }

  if (mode === "ios" && iosTarget === "inApp") {
    return (
      <Modal open onClose={close} title="Відкрийте у браузері">
        <p className="confirm-message">
          Ви у вбудованому браузері застосунку — звідси Splitka не
          встановлюється, і ваше ім&apos;я в групі тут не збережеться.
          Відкрийте це посилання в Safari або Chrome.
        </p>
        <ol className="install-steps">
          <li>
            <span>Скопіюйте лінк кнопкою нижче</span>
          </li>
          <li>
            <span>Вставте його в адресний рядок Safari</span>
          </li>
        </ol>
        <div className="modal-actions">
          <button className="btn ghost" onClick={close}>
            Пропустити
          </button>
          <button className="btn" onClick={copyLink}>
            {copied ? "Скопійовано ✓" : "Скопіювати лінк"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={mode !== "hidden"} onClose={close} title="Встановіть Splitka">
      {mode === "ios" ? (
        <>
          <p className="confirm-message">
            Додайте Splitka на Початковий екран — апка відкриватиметься миттєво
            і працюватиме на весь екран.
          </p>
          <IosSteps target={iosTarget as Exclude<IosTarget, "inApp">} />
          <button className="btn" onClick={close}>
            Зрозуміло
          </button>
        </>
      ) : (
        <>
          <p className="confirm-message">
            Додайте Splitka на головний екран — апка запускатиметься миттєво і
            працюватиме як звичайний застосунок.
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
