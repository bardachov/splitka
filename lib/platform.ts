/**
 * Every iOS browser puts the share control somewhere else, and embedded
 * webviews cannot add to the home screen at all.
 */
export type IosTarget = "safari" | "topRight" | "behindMenu" | "inApp";

const IN_APP_MARKERS =
  /FBAN|FBAV|FB_IAB|Instagram|Telegram|Twitter|LinkedInApp|Line\/|MicroMessenger|Viber|Snapchat|Pinterest|WhatsApp/i;

export function isIosUA(ua: string, maxTouchPoints: number): boolean {
  // iPadOS in desktop mode reports itself as Macintosh but has touch points.
  const iPadAsMac = /macintosh/i.test(ua) && maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadAsMac;
}

export function detectIosTarget(ua: string): IosTarget {
  if (IN_APP_MARKERS.test(ua)) return "inApp";
  if (/CriOS|DuckDuckGo/i.test(ua)) return "topRight";
  if (/FxiOS|EdgiOS|OPT\//i.test(ua)) return "behindMenu";
  // A real browser tab always carries the Safari token; most embedded
  // webviews drop it.
  if (!/Safari\//i.test(ua)) return "inApp";
  return "safari";
}
