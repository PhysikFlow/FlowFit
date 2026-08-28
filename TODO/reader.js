(() => {
  "use strict";

  const DOCUMENT_PRESENTATION = {
    "AUDITORIA_DESIGN_SYSTEM_E_HIERARQUIA_VISUAL.md": {
      id: "design-system",
      order: 1,
      kicker: "Design e hierarquia",
      shortTitle: "Design system",
      description: "Diagnóstico sistêmico da composição visual do FlowFit, com problemas confirmados, soluções e critérios verificáveis."
    },
    "FLUXOS_ATUAIS_INCOMPLETOS.md": {
      id: "fluxos-atuais",
      order: 2,
      kicker: "Auditoria operacional",
      shortTitle: "Fluxos incompletos",
      description: "Lacunas concretas nos fluxos que já existem, classificadas por risco, impacto e critério de aceite."
    },
    "DADOS_DE_TREINO_E_PRIORIDADE_DA_UI.md": {
      id: "dados-de-treino",
      order: 3,
      kicker: "Contrato de treino",
      shortTitle: "Dados do treino",
      description: "Mapa do que o personal realmente prescreve, do que o sistema deriva e do que deve permanecer fora do caminho principal."
    },
    "ROADMAP_PRODUTO_FINAL.md": {
      id: "roadmap-produto",
      order: 4,
      kicker: "Visão de produto",
      shortTitle: "Produto final",
      description: "Checklist amplo de capacidades necessárias para transformar o FlowFit em um produto comercial completo e seguro."
    }
  };

  const STORAGE = {
    theme: "flowfit.todo-reader.theme",
    tasks: "flowfit.todo-reader.tasks",
    lastDocument: "flowfit.todo-reader.last-document"
  };

  const state = {
    documents: [],
    currentDocument: null,
    currentFilter: "all",
    taskStates: readJsonStorage(STORAGE.tasks, {}),
    searchResults: [],
    activeSearchIndex: -1,
    headingObserver: null,
    toastTimer: null
  };

  const elements = {
    nav: document.querySelector("[data-document-nav]"),
    library: document.querySelector("[data-library]"),
    libraryCount: document.querySelector("[data-library-count]"),
    libraryTasks: document.querySelector("[data-library-tasks]"),
    hero: document.querySelector("[data-document-hero]"),
    kicker: document.querySelector("[data-document-kicker]"),
    title: document.querySelector("[data-document-title]"),
    description: document.querySelector("[data-document-description]"),
    shortTitle: document.querySelector("[data-current-short-title]"),
    readTime: document.querySelector("[data-read-time]"),
    sectionCount: document.querySelector("[data-section-count]"),
    taskCount: document.querySelector("[data-task-count]"),
    taskControls: document.querySelector("[data-task-controls]"),
    taskProgressLabel: document.querySelector("[data-task-progress-label]"),
    taskProgress: document.querySelector("[data-task-progress]"),
    content: document.querySelector("[data-document-content]"),
    toc: document.querySelector("[data-table-of-contents]"),
    outline: document.querySelector("[data-outline]"),
    prev: document.querySelector("[data-prev-document]"),
    next: document.querySelector("[data-next-document]"),
    readingProgress: document.querySelector("[data-reading-progress]"),
    searchDialog: document.querySelector("[data-search-dialog]"),
    searchInput: document.querySelector("[data-global-search]"),
    searchSummary: document.querySelector("[data-search-summary]"),
    searchResults: document.querySelector("[data-search-results]"),
    toast: document.querySelector("[data-toast]"),
    themeIcon: document.querySelector("[data-theme-icon]")
  };

  function readJsonStorage(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {
      // A leitura continua funcional mesmo quando o navegador bloqueia persistência.
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugify(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "secao";
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function stripMarkdown(value) {
    return String(value ?? "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!?(\[([^\]]+)\])\(([^)]+)\)/g, "$2")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
      .replace(/\[[ xX]\]\s*/g, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/[|*_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderInline(raw) {
    const placeholders = [];
    let text = String(raw ?? "").replace(/`([^`]+)`/g, (_, code) => {
      const key = `\u0000CODE${placeholders.length}\u0000`;
      placeholders.push(`<code>${escapeHtml(code)}</code>`);
      return key;
    });

    text = escapeHtml(text);
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
      const decodedHref = href.replaceAll("&amp;", "&");
      const isExternal = /^https?:\/\//i.test(decodedHref);
      const attributes = isExternal ? ' target="_blank" rel="noreferrer noopener"' : "";
      return `<a href="${escapeHtml(decodedHref)}"${attributes}>${label}</a>`;
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

    placeholders.forEach((html, index) => {
      text = text.replace(`\u0000CODE${index}\u0000`, html);
    });
    return text;
  }

  function parseTableRow(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  }

  function isTableSeparator(line) {
    if (!line?.trim().startsWith("|")) return false;
    return parseTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function listMatch(line) {
    const match = String(line ?? "").match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
    if (!match) return null;
    return {
      indent: match[1].replaceAll("\t", "    ").length,
      marker: match[2],
      ordered: /^\d/.test(match[2]),
      content: match[3]
    };
  }

  function renderList(lines, startIndex, context, expectedIndent = null) {
    const first = listMatch(lines[startIndex]);
    const indent = expectedIndent ?? first.indent;
    const ordered = first.ordered;
    const tag = ordered ? "ol" : "ul";
    let index = startIndex;
    let html = `<${tag}>`;

    while (index < lines.length) {
      const item = listMatch(lines[index]);
      if (!item || item.indent < indent || item.indent > indent || item.ordered !== ordered) break;

      let content = item.content;
      const task = content.match(/^\[([ xX])\]\s+(.+)$/);
      let liClass = "";
      let taskMarkup = "";

      if (task) {
        const defaultChecked = task[1].toLowerCase() === "x";
        content = task[2];
        const taskKey = `${context.documentId}:${hashString(`${context.taskIndex}:${stripMarkdown(content)}`)}`;
        context.taskIndex += 1;
        const checked = Object.hasOwn(state.taskStates, taskKey) ? Boolean(state.taskStates[taskKey]) : defaultChecked;
        liClass = ' class="task-item"';
        taskMarkup = `<input class="task-checkbox" type="checkbox" data-task-key="${escapeHtml(taskKey)}" aria-label="Marcar item como revisado"${checked ? " checked" : ""}><span class="task-copy">${renderInline(content)}</span>`;
      }

      html += `<li${liClass}>${task ? taskMarkup : renderInline(content)}`;
      index += 1;

      const nested = listMatch(lines[index]);
      if (nested && nested.indent > indent) {
        const nestedResult = renderList(lines, index, context, nested.indent);
        html += nestedResult.html;
        index = nestedResult.index;
      }

      html += "</li>";
    }

    html += `</${tag}>`;
    return { html, index };
  }

  function isBlockStart(lines, index) {
    const line = lines[index] ?? "";
    const next = lines[index + 1] ?? "";
    return !line.trim()
      || /^\s*```/.test(line)
      || /^\s*#{1,6}\s+/.test(line)
      || /^\s*>/.test(line)
      || /^\s*---+\s*$/.test(line)
      || Boolean(listMatch(line))
      || (line.trim().startsWith("|") && isTableSeparator(next));
  }

  function renderMarkdown(source, documentId) {
    const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
    const context = { documentId, taskIndex: 0 };
    const headingSlugs = new Map();
    let index = 0;
    let html = "";

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^\s*```([^\s]*)\s*$/);
      if (fence) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        index += 1;
        html += `<pre${fence[1] ? ` data-language="${escapeHtml(fence[1])}"` : ""}><code>${escapeHtml(code.join("\n"))}</code></pre>`;
        continue;
      }

      if (/^\s*---+\s*$/.test(line)) {
        html += "<hr>";
        index += 1;
        continue;
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const headingTask = heading[2].match(/^\[([ xX])\]\s+(.+)$/);
        const headingContent = headingTask ? headingTask[2] : heading[2];
        const label = stripMarkdown(headingContent);
        const baseSlug = slugify(label);
        const occurrence = headingSlugs.get(baseSlug) ?? 0;
        headingSlugs.set(baseSlug, occurrence + 1);
        const id = occurrence ? `${baseSlug}-${occurrence + 1}` : baseSlug;
        let headingMarkup = renderInline(headingContent);
        let headingClass = "";
        if (headingTask) {
          const defaultChecked = headingTask[1].toLowerCase() === "x";
          const taskKey = `${context.documentId}:${hashString(`heading:${context.taskIndex}:${label}`)}`;
          context.taskIndex += 1;
          const checked = Object.hasOwn(state.taskStates, taskKey) ? Boolean(state.taskStates[taskKey]) : defaultChecked;
          headingClass = ' class="task-heading"';
          headingMarkup = `<input class="task-checkbox" type="checkbox" data-task-key="${escapeHtml(taskKey)}" aria-label="Marcar seção como revisada"${checked ? " checked" : ""}><span class="task-copy">${headingMarkup}</span>`;
        }
        html += `<h${level}${headingClass} id="${escapeHtml(id)}" data-heading-label="${escapeHtml(label)}">${headingMarkup}</h${level}>`;
        index += 1;
        continue;
      }

      if (/^\s*>/.test(line)) {
        const quote = [];
        while (index < lines.length && (/^\s*>/.test(lines[index]) || !lines[index].trim())) {
          if (/^\s*>/.test(lines[index])) quote.push(lines[index].replace(/^\s*>\s?/, ""));
          else quote.push("");
          index += 1;
        }
        const paragraphs = quote.join("\n").split(/\n{2,}/).filter((item) => item.trim());
        html += `<blockquote>${paragraphs.map((item) => `<p>${renderInline(item.replace(/\n/g, " "))}</p>`).join("")}</blockquote>`;
        continue;
      }

      if (line.trim().startsWith("|") && isTableSeparator(lines[index + 1])) {
        const header = parseTableRow(line);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) {
          rows.push(parseTableRow(lines[index]));
          index += 1;
        }
        html += '<div class="table-scroll" tabindex="0" aria-label="Tabela com rolagem horizontal"><table><thead><tr>';
        html += header.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("");
        html += "</tr></thead><tbody>";
        html += rows.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("");
        html += "</tbody></table></div>";
        continue;
      }

      if (listMatch(line)) {
        const result = renderList(lines, index, context);
        html += result.html;
        index = result.index;
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && !isBlockStart(lines, index)) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html += `<p>${renderInline(paragraph.join(" "))}</p>`;
    }

    return html;
  }

  function extractMetadata(rawDocument) {
    const source = rawDocument.content;
    const presentation = DOCUMENT_PRESENTATION[rawDocument.file] ?? {};
    const title = stripMarkdown(source.match(/^#\s+(.+)$/m)?.[1] ?? rawDocument.file.replace(/\.md$/i, ""));
    const words = stripMarkdown(source).split(/\s+/).filter(Boolean).length;
    const taskCount = (source.match(/^\s*(?:[-*+]\s+|#{1,6}\s+)\[[ xX]\]\s+/gm) ?? []).length;
    const headings = [...source.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
      level: match[1].length,
      label: stripMarkdown(match[2])
    }));

    return {
      ...rawDocument,
      id: presentation.id ?? slugify(rawDocument.file.replace(/\.md$/i, "")),
      order: presentation.order ?? 999,
      kicker: presentation.kicker ?? "Documento",
      shortTitle: presentation.shortTitle ?? title,
      description: presentation.description ?? "Documento de produto e implementação do FlowFit.",
      title,
      words,
      readMinutes: Math.max(1, Math.ceil(words / 215)),
      taskCount,
      sectionCount: headings.filter((heading) => heading.level >= 2 && heading.level <= 4).length,
      searchSections: buildSearchSections(source, title)
    };
  }

  function buildSearchSections(source, documentTitle) {
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    const sections = [];
    let current = { heading: documentTitle, slug: "", lines: [] };
    const occurrences = new Map();

    const commit = () => {
      const text = stripMarkdown(current.lines.join("\n"));
      if (text) sections.push({ ...current, text });
    };

    lines.forEach((line) => {
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (!heading) {
        current.lines.push(line);
        return;
      }

      commit();
      const label = stripMarkdown(heading[2]);
      const base = slugify(label);
      const count = occurrences.get(base) ?? 0;
      occurrences.set(base, count + 1);
      current = {
        heading: label,
        slug: count ? `${base}-${count + 1}` : base,
        lines: []
      };
    });
    commit();
    return sections;
  }

  async function loadDocuments() {
    const embedded = window.FLOWFIT_TODO_CONTENT?.documents ?? [];
    const knownFiles = embedded.length ? embedded.map((document) => document.file) : Object.keys(DOCUMENT_PRESENTATION);

    const fresh = await Promise.all(knownFiles.map(async (file) => {
      try {
        const response = await fetch(`./${encodeURIComponent(file)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { file, content: await response.text(), modifiedAt: response.headers.get("last-modified") };
      } catch {
        return embedded.find((document) => document.file === file) ?? null;
      }
    }));

    return fresh.filter(Boolean).map(extractMetadata).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"));
  }

  function routeState() {
    const raw = location.hash.replace(/^#/, "");
    const params = new URLSearchParams(raw);
    return {
      documentId: params.get("doc"),
      section: params.get("section")
    };
  }

  function updateRoute(documentId, section = "", { replace = false } = {}) {
    const params = new URLSearchParams({ doc: documentId });
    if (section) params.set("section", section);
    const url = `${location.pathname}${location.search}#${params.toString()}`;
    history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function renderNavigation() {
    elements.nav.innerHTML = state.documents.map((document) => `
      <a class="document-link" href="#doc=${encodeURIComponent(document.id)}" data-document-id="${escapeHtml(document.id)}">
        <span class="document-link__content">
          <strong>${escapeHtml(document.shortTitle)}</strong>
          <small>${document.readMinutes} min · ${document.taskCount ? `${document.taskCount} itens` : `${document.sectionCount} seções`}</small>
        </span>
      </a>
    `).join("");

    elements.libraryCount.textContent = String(state.documents.length);
    elements.libraryTasks.textContent = String(state.documents.reduce((total, document) => total + document.taskCount, 0));
  }

  function enhanceHeadings() {
    const headings = [...elements.content.querySelectorAll("h1, h2, h3, h4")];
    headings.forEach((heading, index) => {
      if (index === 0 && heading.tagName === "H1") return;
      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#doc=${encodeURIComponent(state.currentDocument.id)}&section=${encodeURIComponent(heading.id)}`;
      anchor.setAttribute("aria-label", `Link para ${heading.dataset.headingLabel}`);
      anchor.textContent = "#";
      heading.append(anchor);

      if (heading.tagName === "H2") {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "section-toggle";
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", `Recolher seção ${heading.dataset.headingLabel}`);
        heading.append(toggle);
      }
    });
  }

  function renderTableOfContents() {
    const headings = [...elements.content.querySelectorAll("h1:not(:first-child), h2, h3, h4")];
    elements.toc.innerHTML = headings.map((heading) => {
      const level = heading.tagName === "H1" ? 2 : Number(heading.tagName.slice(1));
      return `<a class="toc-link" data-level="${level}" href="#doc=${encodeURIComponent(state.currentDocument.id)}&section=${encodeURIComponent(heading.id)}" data-section-id="${escapeHtml(heading.id)}">${escapeHtml(heading.dataset.headingLabel)}</a>`;
    }).join("");

    state.headingObserver?.disconnect();
    state.headingObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      setActiveToc(visible[0].target.id);
    }, { rootMargin: "-90px 0px -72% 0px", threshold: [0, 1] });
    headings.forEach((heading) => state.headingObserver.observe(heading));
  }

  function setActiveToc(sectionId) {
    elements.toc.querySelectorAll(".toc-link").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.sectionId === sectionId);
    });
  }

  function updateTaskProgress() {
    const tasks = [...elements.content.querySelectorAll(".task-checkbox")];
    const done = tasks.filter((task) => task.checked).length;
    const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    elements.taskControls.hidden = tasks.length === 0;
    elements.taskProgressLabel.textContent = `${done} de ${tasks.length} revisados neste navegador`;
    elements.taskProgress.style.width = `${percent}%`;
    elements.taskCount.textContent = tasks.length ? String(tasks.length) : "—";
    applyTaskFilter();
  }

  function applyTaskFilter() {
    elements.content.querySelectorAll(".task-item").forEach((item) => {
      const checked = item.querySelector(":scope > .task-checkbox")?.checked ?? false;
      const filtered = state.currentFilter === "pending" ? checked : state.currentFilter === "done" ? !checked : false;
      item.classList.toggle("is-filtered", filtered);
    });

    elements.content.querySelectorAll(".task-heading").forEach((heading) => {
      const checked = heading.querySelector(":scope > .task-checkbox")?.checked ?? false;
      const filtered = state.currentFilter === "pending" ? checked : state.currentFilter === "done" ? !checked : false;
      const key = heading.querySelector(":scope > .task-checkbox")?.dataset.taskKey;
      const level = Number(heading.tagName.slice(1));
      heading.classList.toggle("is-filtered", filtered);
      let sibling = heading.nextElementSibling;
      while (sibling) {
        const siblingLevel = /^H[1-6]$/.test(sibling.tagName) ? Number(sibling.tagName.slice(1)) : 7;
        if (siblingLevel <= level) break;
        if (filtered) {
          sibling.hidden = true;
          sibling.dataset.filteredByTask = key;
        } else if (sibling.dataset.filteredByTask === key) {
          sibling.hidden = false;
          delete sibling.dataset.filteredByTask;
        }
        sibling = sibling.nextElementSibling;
      }
    });
  }

  function renderPager() {
    const index = state.documents.findIndex((document) => document.id === state.currentDocument.id);
    const previous = state.documents[(index - 1 + state.documents.length) % state.documents.length];
    const next = state.documents[(index + 1) % state.documents.length];
    elements.prev.dataset.documentId = previous.id;
    elements.prev.querySelector("strong").textContent = previous.shortTitle;
    elements.next.dataset.documentId = next.id;
    elements.next.querySelector("strong").textContent = next.shortTitle;
  }

  function renderDocument(documentId, { section = "", updateHistory = true } = {}) {
    const selected = state.documents.find((document) => document.id === documentId) ?? state.documents[0];
    if (!selected) return;

    state.currentDocument = selected;
    state.currentFilter = "all";
    writeStorage(STORAGE.lastDocument, selected.id);

    if (updateHistory) updateRoute(selected.id, section);
    document.title = `${selected.shortTitle} · FlowFit`;
    elements.kicker.textContent = selected.kicker;
    elements.title.textContent = selected.title;
    elements.description.textContent = selected.description;
    elements.shortTitle.textContent = selected.shortTitle;
    elements.readTime.textContent = `${selected.readMinutes} min`;
    elements.sectionCount.textContent = String(selected.sectionCount);
    elements.taskCount.textContent = selected.taskCount ? String(selected.taskCount) : "—";
    elements.hero.setAttribute("aria-busy", "false");
    elements.content.innerHTML = renderMarkdown(selected.content, selected.id);

    document.querySelectorAll("[data-task-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.taskFilter === "all"));
    });
    elements.nav.querySelectorAll("[data-document-id]").forEach((link) => {
      if (link.dataset.documentId === selected.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    enhanceHeadings();
    renderTableOfContents();
    updateTaskProgress();
    renderPager();
    closeLibrary();
    closeOutline();

    requestAnimationFrame(() => {
      if (section) {
        document.getElementById(section)?.scrollIntoView({ block: "start" });
        setActiveToc(section);
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      updateReadingProgress();
    });
  }

  function updateReadingProgress() {
    if (!state.currentDocument) return;
    const rect = elements.content.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const available = Math.max(1, elements.content.offsetHeight - window.innerHeight * 0.58);
    const progress = Math.min(1, Math.max(0, (window.scrollY - absoluteTop + 120) / available));
    elements.readingProgress.style.width = `${Math.round(progress * 100)}%`;
  }

  function openLibrary() {
    elements.library.classList.add("is-open");
    document.body.classList.add("is-library-open");
    document.querySelector("[data-open-library]")?.setAttribute("aria-expanded", "true");
  }

  function closeLibrary() {
    elements.library.classList.remove("is-open");
    document.body.classList.remove("is-library-open");
    document.querySelector("[data-open-library]")?.setAttribute("aria-expanded", "false");
  }

  function toggleOutline() {
    const open = elements.outline.classList.toggle("is-open");
    document.querySelectorAll("[data-toggle-outline]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
  }

  function closeOutline() {
    elements.outline.classList.remove("is-open");
    document.querySelectorAll("[data-toggle-outline]").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function openSearch(initialQuery = "") {
    if (!elements.searchDialog.open) elements.searchDialog.showModal();
    elements.searchInput.value = initialQuery;
    runSearch(initialQuery);
    requestAnimationFrame(() => elements.searchInput.focus());
  }

  function closeSearch() {
    if (elements.searchDialog.open) elements.searchDialog.close();
    state.searchResults = [];
    state.activeSearchIndex = -1;
  }

  function normalizeSearch(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function buildSnippet(text, normalizedQuery) {
    const normalizedText = normalizeSearch(text);
    const firstTerm = normalizedQuery.split(/\s+/).find(Boolean) ?? "";
    const matchIndex = Math.max(0, normalizedText.indexOf(firstTerm));
    const start = Math.max(0, matchIndex - 72);
    const end = Math.min(text.length, start + 220);
    return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
  }

  function highlightTerms(text, terms) {
    let html = escapeHtml(text);
    terms.filter((term) => term.length > 1).forEach((term) => {
      const expression = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      html = html.replace(expression, "<mark>$1</mark>");
    });
    return html;
  }

  function runSearch(query) {
    const normalizedQuery = normalizeSearch(query).trim();
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    if (normalizedQuery.length < 2) {
      state.searchResults = [];
      state.activeSearchIndex = -1;
      elements.searchSummary.textContent = "Digite ao menos dois caracteres para pesquisar em todos os documentos.";
      elements.searchResults.innerHTML = '<div class="search-empty">Os resultados incluem títulos, seções, problemas, soluções e checklists.</div>';
      return;
    }

    const results = [];
    state.documents.forEach((document) => {
      document.searchSections.forEach((section) => {
        const haystack = normalizeSearch(`${document.title} ${section.heading} ${section.text}`);
        if (!terms.every((term) => haystack.includes(term))) return;
        const headingText = normalizeSearch(section.heading);
        const titleText = normalizeSearch(document.title);
        const occurrences = terms.reduce((score, term) => score + (headingText.includes(term) ? 8 : 0) + (titleText.includes(term) ? 4 : 0) + (haystack.split(term).length - 1), 0);
        results.push({
          document,
          section,
          score: occurrences,
          snippet: buildSnippet(section.text, normalizedQuery)
        });
      });
    });

    state.searchResults = results.sort((a, b) => b.score - a.score).slice(0, 18);
    state.activeSearchIndex = state.searchResults.length ? 0 : -1;
    elements.searchSummary.textContent = state.searchResults.length
      ? `${state.searchResults.length} resultado${state.searchResults.length === 1 ? "" : "s"} mais relevante${state.searchResults.length === 1 ? "" : "s"}`
      : "Nenhum trecho encontrado. Tente uma palavra mais ampla.";

    elements.searchResults.innerHTML = state.searchResults.length
      ? state.searchResults.map((result, index) => `
          <button class="search-result${index === 0 ? " is-active" : ""}" type="button" role="option" aria-selected="${index === 0}" data-search-index="${index}">
            <span class="search-result__path">${escapeHtml(result.document.shortTitle)}</span>
            <strong>${highlightTerms(result.section.heading, terms)}</strong>
            <p>${highlightTerms(result.snippet, terms)}</p>
          </button>
        `).join("")
      : '<div class="search-empty">Não encontramos esse termo nos documentos atuais.</div>';
  }

  function moveSearchSelection(direction) {
    if (!state.searchResults.length) return;
    state.activeSearchIndex = (state.activeSearchIndex + direction + state.searchResults.length) % state.searchResults.length;
    elements.searchResults.querySelectorAll(".search-result").forEach((result, index) => {
      const active = index === state.activeSearchIndex;
      result.classList.toggle("is-active", active);
      result.setAttribute("aria-selected", String(active));
      if (active) result.scrollIntoView({ block: "nearest" });
    });
  }

  function openSearchResult(index) {
    const result = state.searchResults[index];
    if (!result) return;
    closeSearch();
    renderDocument(result.document.id, { section: result.section.slug });
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    elements.themeIcon.textContent = theme === "light" ? "☀" : "☾";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f4f7f5" : "#08100e");
    writeStorage(STORAGE.theme, theme);
  }

  function showToast(message) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
  }

  async function copyCurrentLink() {
    const activeSection = elements.toc.querySelector(".is-active")?.dataset.sectionId ?? "";
    const params = new URLSearchParams({ doc: state.currentDocument.id });
    if (activeSection) params.set("section", activeSection);
    const link = `${location.origin}${location.pathname}#${params.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link da seção copiado.");
    } catch {
      const input = document.createElement("textarea");
      input.value = link;
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      showToast("Link copiado.");
    }
  }

  function bindEvents() {
    elements.nav.addEventListener("click", (event) => {
      const link = event.target.closest("[data-document-id]");
      if (!link) return;
      event.preventDefault();
      if (link.dataset.documentId !== state.currentDocument?.id) renderDocument(link.dataset.documentId);
      else closeLibrary();
    });

    elements.toc.addEventListener("click", (event) => {
      const link = event.target.closest("[data-section-id]");
      if (!link) return;
      event.preventDefault();
      const section = link.dataset.sectionId;
      updateRoute(state.currentDocument.id, section, { replace: true });
      document.getElementById(section)?.scrollIntoView({ block: "start" });
      setActiveToc(section);
      closeOutline();
    });

    elements.content.addEventListener("click", (event) => {
      const toggle = event.target.closest(".section-toggle");
      if (toggle) {
        const heading = toggle.closest("h2");
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        let sibling = heading.nextElementSibling;
        while (sibling && sibling.tagName !== "H1" && sibling.tagName !== "H2") {
          sibling.hidden = expanded;
          sibling = sibling.nextElementSibling;
        }
        toggle.setAttribute("aria-expanded", String(!expanded));
        toggle.setAttribute("aria-label", `${expanded ? "Expandir" : "Recolher"} seção ${heading.dataset.headingLabel}`);
        return;
      }

      const anchor = event.target.closest(".heading-anchor");
      if (anchor) {
        event.preventDefault();
        const section = anchor.closest("[id]")?.id;
        updateRoute(state.currentDocument.id, section, { replace: true });
        copyCurrentLink();
      }
    });

    elements.content.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".task-checkbox");
      if (!checkbox) return;
      state.taskStates[checkbox.dataset.taskKey] = checkbox.checked;
      writeStorage(STORAGE.tasks, state.taskStates);
      updateTaskProgress();
      showToast("Progresso salvo somente neste navegador; o Markdown não foi alterado.");
    });

    document.querySelectorAll("[data-task-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.currentFilter = button.dataset.taskFilter;
        document.querySelectorAll("[data-task-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
        applyTaskFilter();
      });
    });

    document.querySelectorAll("[data-open-library]").forEach((button) => button.addEventListener("click", openLibrary));
    document.querySelectorAll("[data-close-library]").forEach((button) => button.addEventListener("click", closeLibrary));
    document.querySelectorAll("[data-toggle-outline]").forEach((button) => button.addEventListener("click", toggleOutline));
    document.querySelectorAll("[data-open-search]").forEach((button) => button.addEventListener("click", () => openSearch()));
    document.querySelectorAll("[data-close-search]").forEach((button) => button.addEventListener("click", closeSearch));

    elements.searchInput.addEventListener("input", () => runSearch(elements.searchInput.value));
    elements.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSearchSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSearchSelection(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        openSearchResult(state.activeSearchIndex);
      }
    });
    elements.searchResults.addEventListener("click", (event) => {
      const result = event.target.closest("[data-search-index]");
      if (result) openSearchResult(Number(result.dataset.searchIndex));
    });
    elements.searchDialog.addEventListener("click", (event) => {
      if (event.target === elements.searchDialog) closeSearch();
    });

    document.querySelector("[data-toggle-theme]")?.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    });
    document.querySelector("[data-toggle-focus]")?.addEventListener("click", (event) => {
      const active = document.body.classList.toggle("is-focus-mode");
      event.currentTarget.setAttribute("aria-pressed", String(active));
      event.currentTarget.setAttribute("aria-label", active ? "Sair do modo de foco" : "Ativar modo de foco");
      showToast(active ? "Modo de foco ativado." : "Navegação restaurada.");
    });
    document.querySelector("[data-copy-link]")?.addEventListener("click", copyCurrentLink);
    document.querySelector("[data-print]")?.addEventListener("click", () => window.print());
    document.querySelector("[data-home-link]")?.addEventListener("click", (event) => {
      event.preventDefault();
      renderDocument(state.documents[0].id);
    });

    elements.prev.addEventListener("click", () => renderDocument(elements.prev.dataset.documentId));
    elements.next.addEventListener("click", () => renderDocument(elements.next.dataset.documentId));

    window.addEventListener("scroll", updateReadingProgress, { passive: true });
    window.addEventListener("resize", () => {
      updateReadingProgress();
      if (window.innerWidth > 800) closeLibrary();
      if (window.innerWidth > 1220) closeOutline();
    });
    window.addEventListener("popstate", () => {
      const route = routeState();
      renderDocument(route.documentId, { section: route.section, updateHistory: false });
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (event.key === "/" && !typing && !elements.searchDialog.open) {
        event.preventDefault();
        openSearch();
      } else if (event.key === "Escape") {
        closeLibrary();
        closeOutline();
      }
    });
  }

  async function init() {
    const savedTheme = localStorage.getItem(STORAGE.theme);
    const preferredTheme = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : preferredTheme);

    try {
      state.documents = await loadDocuments();
      if (!state.documents.length) throw new Error("Nenhum documento Markdown encontrado.");
      renderNavigation();
      bindEvents();

      const route = routeState();
      const savedDocument = localStorage.getItem(STORAGE.lastDocument);
      const initialId = route.documentId || savedDocument || state.documents[0].id;
      renderDocument(initialId, { section: route.section, updateHistory: !route.documentId });
    } catch (error) {
      console.error("Falha ao iniciar a Central de produto", error);
      elements.hero.setAttribute("aria-busy", "false");
      elements.title.textContent = "Não foi possível carregar os documentos";
      elements.description.textContent = "Execute `node TODO/build-reader.mjs` para atualizar a cópia local dos arquivos Markdown e recarregue esta página.";
      elements.content.innerHTML = `<p><strong>Detalhe:</strong> ${escapeHtml(error.message)}</p>`;
    }
  }

  init();
})();
