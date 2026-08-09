import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const captureDir = process.argv[3] || "";
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const chromePath = chromeCandidates.find(existsSync);

if (captureDir) mkdirSync(captureDir, { recursive: true });

if (!chromePath) {
  console.error("Chrome ou Edge não encontrado. Defina CHROME_PATH para executar o smoke test.");
  process.exit(2);
}

const viewports = [
  { name: "mobile-small", width: 320, height: 700 },
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 }
];

const routes = [
  ["professor-dashboard", "/appProfessor/#dashboard"],
  ["professor-students", "/appProfessor/#students"],
  ["professor-workouts", "/appProfessor/#workouts"],
  ["professor-appearance", "/appProfessor/#appearance"],
  ["professor-profile", "/appProfessor/#profile"],
  ["student-home", "/appAluno/#home"],
  ["student-workout", "/appAluno/#workout"],
  ["student-progress", "/appAluno/#progress"],
  ["student-schedule", "/appAluno/#schedule"],
  ["student-profile", "/appAluno/#profile"],
  ["admin", "/admin/"]
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const port = 9339;
const profileDir = mkdtempSync(join(tmpdir(), "flowfit-ui-smoke-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "about:blank"
], { stdio: "ignore", windowsHide: true });

const waitForTarget = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // O Chrome ainda está iniciando.
    }
    await delay(100);
  }
  throw new Error("Chrome não abriu a porta de depuração a tempo.");
};

const createCdpClient = async (webSocketUrl) => {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  return { socket, send };
};

const inspectExpression = `(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const accessibleName = (element) => element.getAttribute("aria-label")
    || element.getAttribute("title")
    || element.textContent?.trim().replace(/\\s+/g, " ").slice(0, 48)
    || "";
  const label = (element) => accessibleName(element) || element.tagName.toLowerCase();
  const overflowElements = [...document.querySelectorAll("body *")]
    .filter(visible)
    .filter((element) => !element.closest('[aria-hidden="true"]'))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    })
    .slice(0, 8)
    .map((element) => ({ element: element.tagName.toLowerCase(), label: label(element), rect: element.getBoundingClientRect().toJSON() }));
  const tinyTargets = [...document.querySelectorAll(".button, .icon-button, .bottom-nav a, .side-nav a, .admin-sidebar a")]
    .filter(visible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 32 || rect.height < 32;
    })
    .slice(0, 8)
    .map((element) => ({ label: label(element), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) }));
  const unnamedActions = [...document.querySelectorAll("button, a[href]")]
    .filter(visible)
    .filter((element) => !accessibleName(element))
    .slice(0, 8)
    .map((element) => element.outerHTML.slice(0, 120));
  const unlabeledFields = [...document.querySelectorAll("input, select, textarea")]
    .filter(visible)
    .filter((element) => !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby"))
    .slice(0, 8)
    .map((element) => element.outerHTML.slice(0, 120));
  const idCounts = [...document.querySelectorAll("[id]")].reduce((counts, element) => {
    counts[element.id] = (counts[element.id] || 0) + 1;
    return counts;
  }, {});
  return {
    title: document.title,
    viewport: [innerWidth, innerHeight],
    documentWidth: document.documentElement.scrollWidth,
    overflowElements,
    tinyTargets,
    unnamedActions,
    unlabeledFields,
    duplicateIds: Object.entries(idCounts).filter(([, count]) => count > 1),
    activePages: [...document.querySelectorAll("[data-page].is-active")].map((element) => element.dataset.page),
    hiddenViolations: [...document.querySelectorAll("[hidden]")].filter((element) => getComputedStyle(element).display !== "none").length,
    appErrors: window.FlowFitProfessorErrors || window.FlowFitAlunoErrors || window.FlowFitAdminErrors || []
  };
})()`;

let client;
const results = [];

try {
  const target = await waitForTarget();
  client = await createCdpClient(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width < 768,
      screenWidth: viewport.width,
      screenHeight: viewport.height
    });

    for (const [name, path] of routes) {
      await client.send("Page.navigate", { url: `${baseUrl}${path}` });
      await delay(650);
      const response = await client.send("Runtime.evaluate", {
        expression: inspectExpression,
        returnByValue: true
      });
      results.push({ viewport: viewport.name, route: name, ...response.result.value });

      if (captureDir) {
        const screenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false
        });
        writeFileSync(join(captureDir, `${viewport.name}-${name}.png`), Buffer.from(screenshot.data, "base64"));

        await client.send("Runtime.evaluate", {
          expression: `(() => {
            document.querySelectorAll("[data-auth-gate], [data-onboarding]").forEach((gate) => {
              gate.style.setProperty("display", "none", "important");
            });
            document.body.classList.remove("is-auth-locked", "has-onboarding");
          })()`
        });
        const appScreenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false
        });
        writeFileSync(join(captureDir, `${viewport.name}-${name}-app.png`), Buffer.from(appScreenshot.data, "base64"));
      }
    }
  }
} finally {
  client?.socket.close();
  chrome.kill();
  await delay(150);
  if (profileDir.startsWith(tmpdir())) rmSync(profileDir, { recursive: true, force: true });
}

const failures = results.filter((result) => (
  result.documentWidth > result.viewport[0] + 1
  || result.tinyTargets.length > 0
  || result.unnamedActions.length > 0
  || result.unlabeledFields.length > 0
  || result.duplicateIds.length > 0
  || result.hiddenViolations > 0
  || result.appErrors.length > 0
));

console.log(JSON.stringify({ checked: results.length, failures, results }, null, 2));
process.exitCode = failures.length ? 1 : 0;
