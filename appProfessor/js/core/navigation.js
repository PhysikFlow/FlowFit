export const createNavigation = ({ pages, navItems, title, pageTitles, onNavigate } = {}) => {
  const hasPage = (name) => pages.some((page) => page.dataset.page === name);

  const navigate = (name, updateHash = true) => {
    const destination = hasPage(name) ? name : "dashboard";
    pages.forEach((page) => page.classList.toggle("is-active", page.dataset.page === destination));
    navItems.forEach((item) => {
      const active = item.dataset.nav === destination;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    if (title) title.textContent = pageTitles[destination] || "Painel";
    document.body.dataset.currentPage = destination;
    onNavigate?.(destination);
    if (updateHash || destination !== name) history.replaceState(null, "", `#${destination}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return destination;
  };

  return { navigate, hasPage };
};
