import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollToTop = (): null => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    // Cleanup any leftover scroll-lock / pointer-events styles that Radix
    // (Dialog, Sheet, Drawer) may have applied to <body> if the user
    // navigated away via a <Link> before the close animation finished.
    // Without this, the next page can render with body { padding-right: Npx;
    // overflow: hidden; pointer-events: none } causing horizontal overflow
    // and unresponsive UI on mobile.
    const body = document.body;
    body.style.removeProperty("pointer-events");
    body.style.removeProperty("overflow");
    body.style.removeProperty("padding-right");
    body.style.removeProperty("margin-right");
    body.removeAttribute("data-scroll-locked");
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
